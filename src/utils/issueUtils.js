export const generateIssueTitle = (error) => {
  return `Error: ${error?.message}`;
};

export const generateIssueBody = (error, warning, options) => {
  const errorMessage = error?.message || 'N/A';
  const errorStack = error?.stack || 'N/A';
  const warnings = warning?.join('\n') || 'N/A';
  const optionsString = JSON.stringify(options, null, 2);

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
\`\`\`
${optionsString}
\`\`\`

Please provide any additional information that might help resolve the issue.
  `;
};