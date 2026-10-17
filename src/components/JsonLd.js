// Server-rendered structured data. `<` is escaped so data can never close the script tag.
const JsonLd = ({ data }) => (
  <script
    type='application/ld+json'
    dangerouslySetInnerHTML={{ __html: JSON.stringify(data).replace(/</g, '\\u003c') }}
  />
);

export default JsonLd;
