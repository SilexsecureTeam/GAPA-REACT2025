// Lightweight ambient declaration for @googlemaps/js-api-loader
// This prevents TypeScript errors when the package isn't installed in the dev environment.
declare module '@googlemaps/js-api-loader' {
  export interface LoaderOptions {
    apiKey?: string;
    version?: string;
    libraries?: string[];
    [key: string]: any;
  }

  export class Loader {
    constructor(opts?: LoaderOptions);
    load(): Promise<void>;
  }

  export default Loader;
}
