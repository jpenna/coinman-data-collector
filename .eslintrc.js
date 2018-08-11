module.exports = {
  "extends": "airbnb-base",
  "rules": {
    "object-curly-newline": ["warn", {
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
    "no-underscore-dangle": 0,
    "no-return-assign": 0,
    "no-param-reassign": 0,
    "func-names": 0,
    "default-case": 0,
    "arrow-body-style": "warn",
  }
};
