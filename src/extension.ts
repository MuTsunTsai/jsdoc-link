import * as vscode from 'vscode';
import { throttle } from 'lodash';

const THROTTLE_DELAY = 800
const hoverEnableDecorationType = vscode.window.createTextEditorDecorationType({
	// `display:none;` will cause trouble with hover message
	textDecoration: 'none; display:inline-block; width:0; height:0; overflow:hidden;',
});
const hiddenDecorationType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'none; display:none;',
});

const commentPattern = /\/\*\*(.+?)\*\//gs;
const linkPattern = /(\{\@link\s+)([^}\s]+)(?:\s+([^}]+?))?\}/gs;

export function activate(context: vscode.ExtensionContext) {
	console.log('jsdoc-link activated');

	const throttledProcess = throttle(() => process(), THROTTLE_DELAY);

	vscode.window.onDidChangeActiveTextEditor(throttledProcess, null, context.subscriptions);
	vscode.window.onDidChangeTextEditorSelection(throttledProcess, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		let editor = vscode.window.activeTextEditor;
		if(event.document == editor?.document) throttledProcess();
	}, null, context.subscriptions);

	throttledProcess();
}

interface DecoratorSet {
	start: vscode.Position;
	end: vscode.Position;
	options: vscode.DecorationOptions[];
}

let decoratorSets: DecoratorSet[];
let linkColor: vscode.ThemeColor;

let textCache: string;

function process() {
	const editor = vscode.window.activeTextEditor;
	const document = editor?.document;
	if(!editor || !document) return;

	// process only JavaScript & TypeScript
	const lang = document.languageId;
	if(lang != "javascript" && lang != "typescript") return;

	// Re-scan document only if text has changed
	let text = document.getText();
	if(textCache != text) {
		textCache = text;
		decoratorSets = [];
		linkColor = new vscode.ThemeColor('textLink.foreground');
		let match: RegExpExecArray | null;
		while(match = commentPattern.exec(text)) {
			let pos = match.index + 3;
			processLink(pos, match[1], document);
		}
	}

	// Exclude selected ones
	let selection = editor.selection;
	let sets = decoratorSets.filter(d =>
		(selection.start.line > d.start.line || d.start.line > selection.end.line) &&
		(selection.start.line > d.end.line || d.start.line > selection.end.line)
	);

	// Grouping
	let hover: vscode.DecorationOptions[] = [];
	let hidden: vscode.DecorationOptions[] = [];
	for(let set of sets) for(let option of set.options) {
		if(option.renderOptions) hover.push(option);
		else hidden.push(option);
	}

	// Set decorations
	editor.setDecorations(hoverEnableDecorationType, hover);
	editor.setDecorations(hiddenDecorationType, hidden);
}

function processLink(pos: number, text: string, document: vscode.TextDocument) {
	let match: RegExpExecArray | null;
	while(match = linkPattern.exec(text)) {
		let s = pos + match.index;
		let start = document.positionAt(s);
		let end = document.positionAt(s + match[0].length);

		if(!match[3]) {
			// when alt text is not used, a simple replacement will do
			decoratorSets.push({
				start, end,
				options: [{
					range: new vscode.Range(start, end),
					renderOptions: {
						after: {
							color: linkColor,
							contentText: match[2],
							fontStyle: 'normal'
						}
					}
				}]
			})
		} else {
			// extra care is necessary to keep the hover message
			let p1 = document.positionAt(s + match[1].length);
			let p2 = document.positionAt(s + match[1].length + match[2].length);
			decoratorSets.push({
				start, end,
				options: [
					{ range: new vscode.Range(start, p1) },
					{ range: new vscode.Range(p2, end) },
					{
						range: new vscode.Range(p1, p2),
						renderOptions: {
							after: {
								color: linkColor,
								contentText: match[3],
								fontStyle: 'normal'
							}
						}
					}
				]
			});
		}
	}
}

export function deactivate() {
	console.log('jsdoc-link deactivated.');
}
