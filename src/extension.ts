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
const linkPattern = /(\{@link\s+)([^|}\s]+)(?:[|\s]\s*([^}\s][^}]*)|\s+)?\}/gs;

export function activate(context: vs.ExtensionContext): void {
	console.log('jsdoc-link activated');

	const throttledProcess = throttle(process, THROTTLE_DELAY);

	vs.window.onDidChangeActiveTextEditor(throttledProcess, null, context.subscriptions);
	vs.window.onDidChangeTextEditorSelection(throttledProcess, null, context.subscriptions);

	vs.workspace.onDidChangeTextDocument(event => {
		const editor = vs.window.activeTextEditor;
		if(event.document == editor?.document) throttledProcess();
	}, null, context.subscriptions);

	throttledProcess();
}

function throttle(func: () => void, wait: number) {
	let last = 0;
	let pending = false;
	function throttled() {
		if(pending) return;
		const diff = Date.now() - last;
		if(diff > wait) {
			func();
			console.log("throttle");
			last += diff;
		} else {
			pending = true;
			setTimeout(() => {
				pending = false;
				throttled();
			}, wait - diff);
		}
	}
	return throttled;
}

interface DecoratorSet {
	start: vs.Position;
	end: vs.Position;
	options: vs.DecorationOptions[];
}

let decoratorSets: DecoratorSet[];
let linkColor: vs.ThemeColor;

let textCache: string;

const supportedLang = ['javascript', 'typescript', 'javascriptreact', 'typescriptreact', 'svelte', 'vue'];

function process(): void {
	const editor = vs.window.activeTextEditor;
	const document = editor?.document;
	if(!editor || !document) return;

	// process only supported languages
	const lang = document.languageId;
	if(!supportedLang.includes(lang)) return;

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

	// Exclude selected ones
	const selection = editor.selection;
	const sets = decoratorSets.filter(d =>
		(selection.start.line > d.start.line || d.start.line > selection.end.line) &&
		(selection.start.line > d.end.line || d.start.line > selection.end.line)
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

function processLink(pos: number, text: string, document: vs.TextDocument) {
	let match: RegExpExecArray | null;
	while(match = linkPattern.exec(text)) {
		const s = pos + match.index;
		const start = document.positionAt(s);
		const end = document.positionAt(s + match[0].length);
		const alt = match[3]?.trim();
		if(!alt) {
			// when alt text is not used, a simple replacement will do
			decoratorSets.push({
				start, end,
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
				start, end,
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

export function deactivate(): void {
	console.log('jsdoc-link deactivated.');
}
