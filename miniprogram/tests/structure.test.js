const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const miniprogramRoot = path.resolve(__dirname, '..');
const projectRoot = path.resolve(miniprogramRoot, '..');

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function assertWxmlBalanced(filePath) {
  const source = fs.readFileSync(filePath, 'utf8').replace(/<!--[^]*?-->/g, '');
  const tagPattern = /<\/?([A-Za-z][\w-]*)\b[^>]*\/?>/g;
  const voidTags = new Set(['image', 'input']);
  const stack = [];
  let match;

  while ((match = tagPattern.exec(source))) {
    const token = match[0];
    const name = match[1];
    if (token.startsWith('</')) {
      assert.equal(stack.pop(), name, `${filePath}: unexpected closing tag ${name}`);
    } else if (!token.endsWith('/>') && !voidTags.has(name)) {
      stack.push(name);
    }
  }

  assert.deepEqual(stack, [], `${filePath}: unclosed WXML tags`);
}

function assertHandlersExist(wxmlPath, jsPath) {
  const wxml = fs.readFileSync(wxmlPath, 'utf8');
  const source = fs.readFileSync(jsPath, 'utf8');
  const handlerPattern = /(?:bind|catch)(?::)?[\w-]+="([A-Za-z_$][\w$]*)"/g;
  let match;

  while ((match = handlerPattern.exec(wxml))) {
    const handler = match[1];
    assert.match(source, new RegExp(`\\b${handler}\\s*\\(`), `${wxmlPath}: missing handler ${handler}`);
  }
}

test('project manifest resolves the assistant page and its native components', () => {
  const projectConfig = readJson(path.join(projectRoot, 'project.config.json'));
  const appConfig = readJson(path.join(miniprogramRoot, 'app.json'));

  assert.equal(projectConfig.miniprogramRoot, 'miniprogram/');
  assert.equal(projectConfig.cloudfunctionRoot, 'cloudfunctions/');
  assert.deepEqual(appConfig.pages, ['pages/assistant/index']);

  for (const page of appConfig.pages) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.ok(fs.existsSync(path.join(miniprogramRoot, `${page}.${extension}`)));
    }
  }

  const pageConfig = readJson(path.join(miniprogramRoot, 'pages/assistant/index.json'));
  for (const componentPath of Object.values(pageConfig.usingComponents)) {
    for (const extension of ['js', 'json', 'wxml', 'wxss']) {
      assert.ok(fs.existsSync(path.join(miniprogramRoot, `${componentPath}.${extension}`)));
    }
  }
});

test('WXML files have balanced tags and bound handlers', () => {
  const surfaces = [
    ['pages/assistant/index.wxml', 'pages/assistant/index.js'],
    ['components/chat-composer/index.wxml', 'components/chat-composer/index.js'],
    ['components/service-sheet/index.wxml', 'components/service-sheet/index.js'],
  ];

  for (const [wxmlRelative, jsRelative] of surfaces) {
    const wxmlPath = path.join(miniprogramRoot, wxmlRelative);
    const jsPath = path.join(miniprogramRoot, jsRelative);
    assertWxmlBalanced(wxmlPath);
    assertHandlersExist(wxmlPath, jsPath);
  }
});
