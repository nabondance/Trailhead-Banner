# CodeSandbox Not Supported

This repository does not support CodeSandbox for the following reasons:

1. **Environment Variables Required**: This application requires multiple environment variables (Vercel Blob, Supabase, etc.) that cannot be safely configured in CodeSandbox.

2. **Server-Side Rendering**: The application uses server-side canvas rendering with specific Node.js dependencies that may not work correctly in CodeSandbox's environment.

3. **pnpm Package Manager**: This project enforces pnpm as the package manager, which may cause issues with CodeSandbox's default npm-based workflow.

## How to Run This Project

Please clone the repository and follow the instructions in the main [README.md](../README.md):

```bash
git clone https://github.com/nabondance/Trailhead-Banner.git
cd Trailhead-Banner
pnpm install
pnpm dev
```

For more information, visit: https://github.com/nabondance/Trailhead-Banner
