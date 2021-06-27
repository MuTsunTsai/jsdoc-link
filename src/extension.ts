import * as vscode from 'vscode';
import { throttle } from 'lodash';

const THROTTLE_DELAY = 800
const hoverEnableDecorationType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'none; display:inline-block; width:0; height:0; overflow:hidden;',
});
const hiddenDecorationType = vscode.window.createTextEditorDecorationType({
	textDecoration: 'none; display:none;',
});

const commentPattern = /\/\*\*(.+?)\*\//gs;
const linkPattern = /(\{\@link\s+)([^}\s]+)(?:\s+([^}]+?))?\}/gs;

export function activate(context: vscode.ExtensionContext) {
	console.log('jsdoc-link activated');

	process();

	const throttledProcess = throttle(() => process(), THROTTLE_DELAY);

	vscode.window.onDidChangeActiveTextEditor(throttledProcess, null, context.subscriptions);
	vscode.window.onDidChangeTextEditorSelection(throttledProcess, null, context.subscriptions);

	vscode.workspace.onDidChangeTextDocument(event => {
		let editor = vscode.window.activeTextEditor;
		if(event.document == editor?.document) throttledProcess();
	}, null, context.subscriptions)
}

let hiddenDecorator: vscode.DecorationOptions[];
let hoverDecorator: vscode.DecorationOptions[];
let linkColor: vscode.ThemeColor;

function process() {
	const editor = vscode.window.activeTextEditor;
	const document = editor?.document;
	if(!editor || !document) return;

	// process only JavaScript & TypeScript
	const lang = document.languageId;
	if(lang != "javascript" && lang != "typescript") return;

	// initialize
	hiddenDecorator = [];
	hoverDecorator = [];
	linkColor = new vscode.ThemeColor('textLink.foreground');

	let selection = editor.selection;
	let text = document.getText();
	let match: RegExpExecArray | null;
	while(match = commentPattern.exec(text)) {
		let pos = match.index + 3;
		processLink(pos, match[1], document, selection);
	}

	editor.setDecorations(hoverEnableDecorationType, hoverDecorator);
	editor.setDecorations(hiddenDecorationType, hiddenDecorator);
}

function processLink(pos: number, text: string, document: vscode.TextDocument, selection: vscode.Selection) {
	let match: RegExpExecArray | null;
	while(match = linkPattern.exec(text)) {
		let s = pos + match.index;
		let start = document.positionAt(s);
		let end = document.positionAt(s + match[0].length);
		if((selection.start.line <= start.line && start.line <= selection.end.line) ||
			(selection.start.line <= end.line && end.line <= selection.end.line)) continue;

		if(!match[3]) {
			// when alt text is not used, a simple replacement will do
			hoverDecorator.push({
				range: new vscode.Range(start, end),
				renderOptions: {
					after: {
						color: linkColor,
						contentText: match[2],
						fontStyle: 'normal'
					}
				}
			});
		} else {
			// extra care is necessary to keep the hover message
			let p1 = document.positionAt(s + match[1].length);
			let p2 = document.positionAt(s + match[1].length + match[2].length);
			hiddenDecorator.push(
				{ range: new vscode.Range(start, p1) },
				{ range: new vscode.Range(p2, end) }
			);
			hoverDecorator.push({
				range: new vscode.Range(p1, p2),
				renderOptions: {
					after: {
						color: linkColor,
						contentText: match[3],
						fontStyle: 'normal'
					}
				}
			});
		}
	}
}

export function deactivate() {
	console.log('jsdoc-link deactivated.');
}
