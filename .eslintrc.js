module.exports = {
  "extends": "airbnb-base",
  "rules": {
    "object-curly-newline": ["error", {
      "ObjectPattern": { "multiline": false },
      "ImportDeclaration": { "consistent": true }
    }],
    "consistent-return": 0,
    "max-len": [1, {
      "code": 100,
      "tabWidth": 2,
      "ignoreUrls": true,
      "ignoreTrailingComments": true,
    }],
    "no-plusplus": 0,
  }
};
