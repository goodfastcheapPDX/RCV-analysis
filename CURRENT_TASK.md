Title: Implement Adze logging library across the application stack

Context:

Implement the Adze logging library to provide structured logging capabilities across the entire application. This includes both client-side and server-side logging with appropriate configuration for different environments.

Scope:

1) Install and configure Adze logging library
2) Set up logging configuration for different environments (dev, test, prod)
3) Replace existing console.log statements with Adze loggers
4) Implement logging in key application areas:
   - API routes and server-side functions
   - Data processing and computation functions
   - Client-side error handling and user interactions
   - Contract validation and data pipeline operations
5) Configure log levels and output formats appropriately
6) Ensure logging works with Next.js SSR/SSG patterns
7) Add proper log sanitization for sensitive data

Done When:

Adze logging is implemented across the application with appropriate log levels and configurations for different environments.

All existing console.log statements are replaced with structured Adze logging.

Logging works correctly in both client and server contexts.

Tests pass and logging doesn't interfere with application functionality.