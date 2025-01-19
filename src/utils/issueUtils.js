export const generateIssueTitle = (error) => {
  return `Error: ${error?.message}`;
};

export const generateIssueBody = (error, warning, options) => {
  return `An error occurred while generating the banner:\n\nError message:\n\`\`\`\n${error?.message}\n\`\`\`\n\nError stack:\n\`\`\`\n${error?.stack}\n\`\`\`\n\nWarnings:\n\`\`\`\n${warning.join('\n')}\n\`\`\`\n\nOptions:\n\`\`\`\n${JSON.stringify(options, null, 2)}\n\`\`\`\n\nPlease provide any additional information that might help resolve the issue.`;
};
