import * as vs from 'vscode';

const THROTTLE_DELAY = 800;
const hoverEnableDecorationType = vs.window.createTextEditorDecorationType({
	// `display:none;` will cause trouble with hover message
	textDecoration: 'none; display:inline-block; width:0; height:0; overflow:hidden;',
});
const hiddenDecorationType = vs.window.createTextEditorDecorationType({
	textDecoration: 'none; display:none;',
});

const commentPattern = /\/\*\*(.+?)\*\//gs;
const linkPattern = /(\{@link(?:code|plain)?\s+)([^|}\s]+)(?:[|\s]\s*([^}\s][^}]*)|\s+)?\}/gs;

const supportedLang = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'svelte', 'vue'];

const documentLinkProvider: vs.DocumentLinkProvider<vs.DocumentLink> = {
	provideDocumentLinks: (document) =>
		scanDocument(document).map(decorator => decorator.link).filter(Boolean) as vs.DocumentLink[]
};

/**
 * Entry point of the extension.
 */
export function activate(context: vs.ExtensionContext): void {
	const throttledProcess = throttle(process, THROTTLE_DELAY);

	// Change editor tab, etc.
	vs.window.onDidChangeActiveTextEditor(throttledProcess.skip, null, context.subscriptions);

	// When cursor moves or selection changes.
	vs.window.onDidChangeTextEditorSelection(throttledProcess, null, context.subscriptions);

	// When the content of the text is changed (by inputting etc.).
	vs.workspace.onDidChangeTextDocument(event => {
		const editor = vs.window.activeTextEditor;
		if(event.document == editor?.document) throttledProcess();
	}, null, context.subscriptions);

	vs.languages.registerDocumentLinkProvider(supportedLang, documentLinkProvider);

	throttledProcess.skip();
}

interface Throttled {
	(): void;
	skip: () => void;
}

function throttle(func: () => void, wait: number): Throttled {
	let last = 0;
	let pending = false;
	function throttled() {
		if(pending) return;
		const diff = Date.now() - last;
		if(diff > wait) {
			func();
			last += diff;
		} else {
			pending = true;
			setTimeout(() => {
				pending = false;
				throttled();
			}, wait - diff);
		}
	}
	throttled.skip = function() {
		last = Date.now();
		func();
	};
	return throttled;
}

interface DecoratorSet {
	start: vs.Position;
	end: vs.Position;
	options: vs.DecorationOptions[];
	link?: vs.DocumentLink;
}

let textCache: string;

/** Current list of {@link DecoratorSet} */
let decoratorSets: DecoratorSet[];

let linkColor: vs.ThemeColor;

function scanDocument(document: vs.TextDocument): DecoratorSet[] {
	// Re-scan document only if text has changed
	const text = document.getText();
	if(textCache != text) {
		textCache = text;
		decoratorSets = [];
		linkColor = new vs.ThemeColor('textLink.foreground');
		let match: RegExpExecArray | null;
		while(match = commentPattern.exec(text)) {
			const pos = match.index + 3;
			processLink(pos, match[1], document);
		}
	}
	return decoratorSets;
}

/**
 * The main routine. Runs whenever selection of document changes.
 */
function process(): void {
	const editor = vs.window.activeTextEditor;
	const document = editor?.document;
	if(!editor || !document) return;

	// process only supported languages
	const lang = document.languageId;
	if(!supportedLang.includes(lang)) return;

	// Exclude selected ones
	const selections = editor.selections;
	const sets = scanDocument(document).filter(d =>
		// for every selection in the editor, it must not intersect the decorator's range
		selections.every(selection =>
			(selection.start.line > d.end.line) || (selection.end.line < d.start.line)
		)
	);

	// Grouping
	const hover: vs.DecorationOptions[] = [];
	const hidden: vs.DecorationOptions[] = [];
	for(const set of sets) {
		for(const option of set.options) {
			if(option.renderOptions) hover.push(option);
			else hidden.push(option);
		}
	}

	// Set decorations
	editor.setDecorations(hoverEnableDecorationType, hover);
	editor.setDecorations(hiddenDecorationType, hidden);
}

function processLink(pos: number, text: string, document: vs.TextDocument): void {
	let match: RegExpExecArray | null;
	while(match = linkPattern.exec(text)) {
		const s = pos + match.index;
		const start = document.positionAt(s);
		const end = document.positionAt(s + match[0].length);
		const alt = match[3]?.trim();

		// Add local file link
		let link: vs.DocumentLink | undefined;
		if(/^(file:)?\.\.?\//.test(match[2])) {
			link = {
				range: new vs.Range(
					document.positionAt(s + match[1].length),
					document.positionAt(s + match[1].length + match[2].length)
				),
				target: vs.Uri.joinPath(document.uri, '..', match[2]),
			};
		}

		if(!alt) {
			// when alt text is not used, a simple replacement will do
			decoratorSets.push({
				start, end, link,
				options: [{
					range: new vs.Range(start, end),
					renderOptions: {
						after: {
							color: linkColor,
							contentText: match[2],
							fontStyle: 'normal'
						}
					}
				}]
			});
		} else {
			// extra care is necessary to keep the hover message
			const p1 = document.positionAt(s + match[1].length);
			const p2 = document.positionAt(s + match[1].length + match[2].length);
			decoratorSets.push({
				start, end, link,
				options: [
					{ range: new vs.Range(start, p1) },
					{ range: new vs.Range(p2, end) },
					{
						range: new vs.Range(p1, p2),
						renderOptions: {
							after: {
								color: linkColor,
								contentText: alt,
								fontStyle: 'normal'
							}
						}
					}
				]
			});
		}
	}
}
