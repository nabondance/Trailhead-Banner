export const generateIssueTitle = (error) => {
  return `Error: ${error?.message}`;
};

export const generateIssueBody = (error, warning, options, version) => {
  const errorMessage = error?.message || 'N/A';
  const errorStack = error?.stack || 'N/A';
  const warnings = warning?.join('\n') || 'N/A';

  return `
An error occurred while generating the banner:

Error message:
\`\`\`
${errorMessage}
\`\`\`

Error stack:
\`\`\`
${errorStack}
\`\`\`

Warnings:
\`\`\`
${warnings}
\`\`\`

Options:
\`\`\`json
${JSON.stringify(options, null, 2)}
\`\`\`

Version: ${version}

Please provide any additional information that might help resolve the issue.
  `;
};
