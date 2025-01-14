# Contributing to Trailhead-Banner

`<!-- markdown-link-check-disable -->`

We love your input! We want to make contributing to this project as easy and transparent as possible, whether it's:

- Reporting a bug
- Discussing the current state of the code
- Submitting a fix
- Proposing new features
- Becoming a maintainer

## We Develop with GitHub

We use GitHub to host code, track issues, and feature requests, as well as accept pull requests.

## We Use [GitHub Flow](https://guides.github.com/introduction/flow/index.html)

Pull requests are the best way to propose changes to the codebase. We actively welcome your pull requests:

1. Fork the repository and create your branch from `main`.
2. If you've added code that should be tested, add tests.
3. If you've changed commands, update the documentation.
4. Ensure the test suite passes.
5. Make sure your code lints (run `npm run lint`).
6. Issue that pull request!

## Report Bugs Using GitHub Issues

We use GitHub issues to track public bugs. Report a bug by [opening a new issue](https://github.com/nabondance/Trailhead-Banner/issues/new); it's that easy!

## Write Bug Reports with Detail, Background, and Sample Code

**Great Bug Reports** tend to have:

- A quick summary and/or background
- Steps to reproduce
  - Be specific!
  - Give sample code if you can
- What you expected would happen
- What actually happens
- Notes (possibly including why you think this might be happening, or stuff you tried that didn't work)

People _love_ thorough bug reports. I'm not even kidding.

## Use a Consistent Coding Style

- We use [Prettier](https://prettier.io/) to maintain code style consistency. Please make sure your code is formatted accordingly.
- Ensure your code passes ESLint checks (run `npm run lint`).

## Use [conventional commits](https://www.conventionalcommits.org/en/v1.0.0/)

```text
<type>(<scope>): <description>

[optional body]

[optional footer(s)]
```

Common type:
`feat, fix, docs, ci, style, refactor, perf, test, build, chore, revert`

Common scope: `core, deps, ui, config, release, util, auth`

## License

By contributing, you agree that your contributions will be licensed under the MIT License.

## Develop

### Init

First, clone the repository:

```bash
git clone https://github.com/yourusername/Trailhead-Banner.git
cd Trailhead-Banner
```

Then, install dependencies

```bash
pnpm install
```

Then, run the development server:

```bash
pnpm run dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

### Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

### UI choices

#### Fonts

- Anta
- Geist
- Roboto

#### Colors

- primary: #009edb
- secondary: #8a00c4
- additional: #003e6b
-
