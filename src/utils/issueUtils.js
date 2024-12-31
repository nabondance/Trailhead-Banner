export const generateIssueTitle = (error) => {
  return `Error: ${error?.message}`;
};

export const generateIssueBody = (error, options) => {
  return `An error occurred while generating the banner:\n\n\`\`\`\n${error?.stack}\n\`\`\`\n\nOptions:\n\`\`\`\n${JSON.stringify(options, null, 2)}\n\`\`\`\n\nPlease provide any additional information that might help resolve the issue.`;
};
