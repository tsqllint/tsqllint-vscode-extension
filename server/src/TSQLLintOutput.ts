import { 
    OutputChannel, window 
} from 'vscode';

export default class TSQLLintOutput {
    private _outputChannel: OutputChannel = null;

    public get Channel(): OutputChannel
    {
        if(null === this._outputChannel){
            this._outputChannel = window.createOutputChannel('TSQLLint');
        }
        return this._outputChannel;
    }
}