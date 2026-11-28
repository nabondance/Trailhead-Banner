import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import prettier from 'eslint-config-prettier/flat';

const eslintConfig = [...nextCoreWebVitals, prettier];

export default eslintConfig;
