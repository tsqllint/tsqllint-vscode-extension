'use strict';

const https = require('follow-redirects').https
const os = require('os')
const fs = require('fs')
const decompress = require('decompress')
const decompressTargz = require('decompress-targz')

export default class TSQLLintRuntimeHelper {

    static _tsqllintVersion: string = 'v1.8.10'
    static _applicationRootDirectory: string;
    static _runTime: string;
    static _tsqllintToolsPath: string;

    constructor(applicationRootDirectory: string) {
        TSQLLintRuntimeHelper._applicationRootDirectory = applicationRootDirectory;

        if (os.type() === 'Darwin') {
            TSQLLintRuntimeHelper._runTime = 'osx-x64'
        } else if (os.type() === 'Linux') {
            TSQLLintRuntimeHelper._runTime = 'linux-x64'
        } else if (os.type() === 'Windows_NT') {
            if (process.arch === 'ia32') {
                TSQLLintRuntimeHelper._runTime = 'win-x86'
            } else if (process.arch === 'x64') {
                TSQLLintRuntimeHelper._runTime = 'win-x64'
            }
        } else {
            throw new Error(`Invalid Platform: ${os.type()}`)
        }
    }

    TSQLLintRuntime(): Promise<string> {
        return new Promise<string>((resolve, reject) => {

            if (TSQLLintRuntimeHelper._tsqllintToolsPath) {
                return resolve(TSQLLintRuntimeHelper._tsqllintToolsPath);
            }

            let tsqllintInstallDirectory: string = `${TSQLLintRuntimeHelper._applicationRootDirectory}/tsqllint`
            if (fs.existsSync(`${tsqllintInstallDirectory}/${TSQLLintRuntimeHelper._runTime}`)) {
                TSQLLintRuntimeHelper._tsqllintToolsPath = tsqllintInstallDirectory;
                return resolve(TSQLLintRuntimeHelper._tsqllintToolsPath);
            }

            let download: Promise<string> = TSQLLintRuntimeHelper.DownloadRuntime(tsqllintInstallDirectory);

            download.then((path: string) => {
                return this.UnzipRuntime(path, tsqllintInstallDirectory);
            }).then((tsqllintInstallDirectory: string) => {
                console.log('Installation of TSQLLint Runtime Complete')
                return resolve(tsqllintInstallDirectory);
            }).catch((error: Error) => {
                return reject(error)
            })
        })
    }

    private UnzipRuntime(path: string, tsqllintInstallDirectory: string) {
        console.log('ONE')

        return new Promise((resolve, reject) => {
            decompress(path, `${tsqllintInstallDirectory}`, {
                plugins: [
                    decompressTargz()
                ]
            }).then(() => {
                console.log('TWO')
                TSQLLintRuntimeHelper._tsqllintToolsPath = tsqllintInstallDirectory;
                return resolve(tsqllintInstallDirectory);
            }).catch((err: Error) => {
                reject(err)
            });
        });
    }

    static DownloadRuntime(installDirectory: string): Promise<string> {
        let urlBase: string = `https://github.com/tsqllint/tsqllint/releases/download/${this._tsqllintVersion}`
        let downloadUrl: string = `${urlBase}/${TSQLLintRuntimeHelper._runTime}.tgz`
        let downloadFilePath: string = `${installDirectory}/${TSQLLintRuntimeHelper._runTime}.tgz`
        let downloadPath: string = `${installDirectory}/${TSQLLintRuntimeHelper._runTime}.tgz`
        
        return new Promise((resolve, reject) => {
            console.log('Installing TSQLLint Runtime');
            if (!fs.existsSync(installDirectory)) {
                fs.mkdirSync(installDirectory);
            }
            var file = fs.createWriteStream(downloadFilePath)
            https.get(downloadUrl, (response: any) => {
                const length = Number(response.headers['content-length']);
                response.pipe(file)

                process.stdout.write('downloading...');

                if (!isNaN(length)) {
                    process.stdout.write(' [');
                    const max = 60;
                    let char = 0;
                    let bytes = 0;
                    response.on('data', (chunk: Buffer) => {
                        bytes += chunk.length;
                        let fill = Math.ceil((bytes / length) * max);
                        for (let i = char; i < fill; i++) process.stdout.write('=');
                        char = fill;
                    });
                    response.on('end', () => process.stdout.write(']'));
                }
                file.on('finish', function () {
                    console.log(' done!');
                    file.close(resolve(downloadPath))
                });
            }).on('response', (res: any) => {
                if (res.statusCode != 200) {
                    fs.unlink(downloadPath)
                    return reject(new Error(`There was a problem downloading ${downloadUrl}`))
                }   
            }).on('error', function (err: Error) {
                fs.unlink(downloadPath)
                reject(err)
            })
        })
    }
}