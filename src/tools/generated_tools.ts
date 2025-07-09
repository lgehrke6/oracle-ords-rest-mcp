import { request } from 'undici';
import { z } from 'zod';
import { makeAuthenticatedRequest } from './oauth_helper';


const schema = process.env.WORKING_SCHEMA;

const OPENAPI_URL = process.env.OPENAPI_URL; 
const BASE_URL = process.env.BASE_URL; 

interface OpenApiCatalog {
  items: OpenApiCatalogItem[]
}

interface OpenApiCatalogItem {
  name: string;
  links: OpenApiCatalogLink[];
}

interface OpenApiCatalogLink {
  rel: string;
  href: string;
  mediaType: string;
}

interface OpenApiPathItem {
  summary?: string;
  description?: string; 
  // Add other OpenAPI operation properties if needed
}

interface OpenApiPaths {
  [path: string]: {
    [method: string]: OpenApiPathItem;
  };
}

interface OpenApiSpec {
  paths?: OpenApiPaths;
  // Add other OpenAPI spec properties if needed
}

export interface ToolInput {
  headers?: Record<string, string>;
  body?: any;
  params?: Record<string, string | number>;
  query?: Record<string, string | number | boolean>; // Added for query parameters not in path
}

export const toolInputSchema = z.object({
  headers: z.record(z.string()).optional(),
  body: z.any().optional(),
  params: z.record(z.union([z.string(), z.number()])).optional(),
  query: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
});

export type ToolFunction = (input: ToolInput) => Promise<{ status_code: number; body: string }>;

export interface ToolDefinition { // New interface to hold function and description
  func: ToolFunction;
  description: string;
}

export const toolRegistry = new Map<string, ToolDefinition>();

async function fetchOpenApiSpec(): Promise<OpenApiSpec[]> {
  const response = await request(OPENAPI_URL, { method: 'GET' });
  if (response.statusCode !== 200) {
    throw new Error(`Failed to fetch OpenAPI spec: ${response.statusCode}`);
  }

  let collectedLinks: OpenApiSpec[] = [];

  const catalog = await response.body.json() as OpenApiCatalog;

  
  for (const item of catalog.items) {
    // Make subsequent requests to fetch the OpenAPI specs

    //TODO: Implement filter option, user should be able to exclude REST Endpoints

    let prepUrl = null;
    prepUrl = OPENAPI_URL + item.name + '/';
    console.log(`Fetching OpenAPI spec from: ${prepUrl}`);

    let itemResponse = await request(prepUrl, { method: 'GET' });
    console.log(`Response status code: ${itemResponse.statusCode}`);

    if (itemResponse.statusCode !== 200) {
      throw new Error(`Failed to fetch OpenAPI spec for ${item.name}: ${itemResponse.statusCode}`);
    }
    let itemSpec = await itemResponse.body.json() as OpenApiSpec;

    collectedLinks.push(itemSpec);
  }

  return collectedLinks;
}

function makeTool(path: string, method: string): ToolFunction {
  return async (input: ToolInput) => {
    const headers = input.headers || {};
    const body = input.body;
    const pathParams = input.params || {}; // Parameters for path templating
    const queryParams = input.query || {}; // Parameters for query string

    let formattedPath = path;
    for (const key in pathParams) {
      if (Object.prototype.hasOwnProperty.call(pathParams, key)) {
        formattedPath = formattedPath.replace(`{${key}}`, String(pathParams[key]));
      }
    }

    const baseUrl = `${BASE_URL}${formattedPath}`;
    
    const requestOptions: Parameters<typeof request>[1] = {
      method: method.toUpperCase(),
      headers: headers,
    };

    if (body !== undefined && body !== null && [
      'post', 'put', 'patch'
    ].indexOf(method.toLowerCase()) !== -1) {
      requestOptions.body = JSON.stringify(body);
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      requestOptions.headers = headers;
    }
    
    const urlSearchParams = new URLSearchParams();
    for (const key in queryParams) {
        if (Object.prototype.hasOwnProperty.call(queryParams, key)) {
            const value = queryParams[key];
            if (typeof value === 'boolean') {
                urlSearchParams.append(key, value.toString());
            } else if (value !== undefined && value !== null) {
                 urlSearchParams.append(key, String(value));
            }
        }
    }

    const queryString = urlSearchParams.toString();
    const finalUrl = queryString ? `${baseUrl}?${queryString}` : baseUrl;


    const res = await makeAuthenticatedRequest(finalUrl, requestOptions);
    const responseBodyText = await res.body.text();
    return { status_code: res.statusCode, body: responseBodyText };
  };
}

export async function initializeTools(): Promise<void> {
  console.log("Starting to initialize tools...");
  try {
    const openapi: OpenApiSpec[] = await fetchOpenApiSpec();

    console.log("Fetched OpenAPI specs:", openapi);
    const paths: OpenApiPaths = openapi.reduce((acc, spec) => {
      if (spec.paths) {
        for (let path in spec.paths) {
          
          if (Object.prototype.hasOwnProperty.call(spec.paths, path)) {
            
            acc[path] = { ...acc[path], ...spec.paths[path] };
          }
        }
      }
      return acc;
    }, {} as OpenApiPaths);
    

    for (const path in paths) {
      if (Object.prototype.hasOwnProperty.call(paths, path)) {
        const methods = paths[path];
        if (typeof methods === 'object' && methods !== null) {
          for (const method in methods) {
            if (Object.prototype.hasOwnProperty.call(methods, method)) {
              const operationDetails = methods[method] as OpenApiPathItem; // Get operation details
              const operationId = `${method}_${schema}_${path.replace(/^\/|\/$/g, '').replace(/\//g, '_')}`;
              
              // Determine the description: use operation's description, fallback to summary, then to a generic one
              const description = operationDetails.description || operationDetails.summary || `Performs a ${method.toUpperCase()} request to ${path}`;

              toolRegistry.set(operationId, {
                func: makeTool(path, method),
                description: description // Store the description
              });
            }
          }
        }
      }
    }
    console.log(`Registered tools: ${Array.from(toolRegistry.keys()).join(', ')}`);
  } catch (error) {
    console.error("Failed to initialize tools:", error);
  }
}
