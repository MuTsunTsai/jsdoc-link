# JSDoc Link

> Preview JSDoc link in-place.

VS Code began to support JSDoc [`@link`](https://jsdoc.app/tags-inline-link.html) syntax
for JavaScript and TypeScript since version 1.57,
which is really cool and helpful,
but at the same time could result in low readability on the doc itself,
especially if alternative text is used:

![](https://github.com/MuTsunTsai/jsdoc-link/raw/main/docs/1.png)

With this extension, all `@link` will be converted to just the link text when the line is not currently selected, and the hovering message is kept as well.

![](https://github.com/MuTsunTsai/jsdoc-link/raw/main/docs/2.png)