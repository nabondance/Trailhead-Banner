import assert from 'node:assert/strict';
import test from 'node:test';

import {
  compareRequirements,
  normalizeContentSource,
  parseTrailRequirements,
  parseTrailmixRequirements,
} from './check-trail-completion.mjs';

test('extracts and deduplicates server-rendered trail requirements', () => {
  const html = `
    <a data-step-type="th-module"
       data-content-api-name="example-module"
       data-content-uid="module-content-id"
       href="/content/learn/modules/example-module?trail_id=example">
      Example &amp; Module
    </a>
    <a data-step-type="th-project"
       data-content-api-name="example-project"
       data-content-uid="project-content-id"
       href="/content/learn/projects/example-project">Example Project</a>
    <a data-step-type="th-module"
       data-content-api-name="example-module"
       data-content-uid="module-content-id">Duplicate</a>
  `;

  assert.deepEqual(parseTrailRequirements(html), [
    {
      stepType: 'th-module',
      awardType: 'MODULE',
      contentId: 'module-content-id',
      apiName: 'example-module',
      title: 'Example & Module',
      url: 'https://trailhead.salesforce.com/content/learn/modules/example-module?trail_id=example',
      supported: true,
    },
    {
      stepType: 'th-project',
      awardType: 'PROJECT',
      contentId: 'project-content-id',
      apiName: 'example-project',
      title: 'Example Project',
      url: 'https://trailhead.salesforce.com/content/learn/projects/example-project',
      supported: true,
    },
  ]);
});

test('matches across Trailhead APIs by URL slug when their content IDs differ', () => {
  const [requirement] = parseTrailRequirements(`
    <a data-step-type="th-module"
       data-content-api-name="same-module"
       data-content-uid="learning-api-id">Same Module</a>
  `);
  const [result] = compareRequirements([requirement], {
    awards: [
      {
        id: 'different-profile-api-id',
        title: 'Same Module',
        type: 'MODULE',
        webUrl: 'https://trailhead.salesforce.com/content/learn/modules/same-module',
        apiName: 'same-module',
      },
    ],
  });

  assert.equal(result.earned, true);
  assert.equal(result.matchedBy, 'api-name');
});

test('extracts award-backed and manual Trail Mix items from embedded JSON', () => {
  const encode = (value) => JSON.stringify(value).replaceAll('&', '&amp;').replaceAll('"', '&quot;');
  const moduleProps = encode({
    content: {
      type: 'module',
      apiName: 'example-module',
      contentUid: 'module-id',
      title: 'Example Module',
      path: '/content/learn/modules/example-module',
    },
  });
  const customProps = encode({
    content: {
      type: 'customstep',
      subtype: 'Th::CustomStepLink',
      title: 'External reading',
      path: 'https://example.com',
      manualCompletion: true,
    },
    completionData: { customStepId: 'custom-id' },
  });

  const requirements = parseTrailmixRequirements(`
    <div data-react-class="ModuleBrick" data-react-props="${moduleProps}"></div>
    <div data-react-class="ModuleBrick" data-react-props="${customProps}"></div>
  `);

  assert.equal(requirements.length, 2);
  assert.deepEqual(requirements[0], {
    trailmixItemIndex: 0,
    stepType: 'trailmix-module',
    awardType: 'MODULE',
    contentId: 'module-id',
    apiName: 'example-module',
    title: 'Example Module',
    url: 'https://trailhead.salesforce.com/content/learn/modules/example-module',
    supported: true,
    contentType: 'module',
    manualCompletion: false,
  });
  assert.equal(requirements[1].supported, false);
  assert.equal(requirements[1].manualCompletion, true);
});

test('recognizes Trail Mix URLs without allowing arbitrary fetch hosts', () => {
  assert.deepEqual(normalizeContentSource('https://trailhead.salesforce.com/users/nabondance/trailmixes/chevre'), {
    type: 'trailmix',
    creator: 'nabondance',
    slug: 'chevre',
    url: 'https://trailhead.salesforce.com/users/nabondance/trailmixes/chevre',
  });
  assert.throws(
    () => normalizeContentSource('https://example.com/users/name/trailmixes/mix'),
    /must use trailhead\.salesforce\.com/
  );
});
