'use strict';

const https = require('follow-redirects').https
const os = require('os')
const fs = require('fs')
const decompress = require('decompress')
const decompressTargz = require('decompress-targz')
const ProgressBar = require('progress')

export default class TSQLLintToolsHelper {

    static _applicationRootDirectory: string;
    static _runTime: string;
    static _tsqllintToolsPath: string;

    static _tsqllintVersion: string = 'v1.8.10'

    TSQLLintToolsPath(): Promise<string> {
        return new Promise<string>((resolve, reject) => {

            // prop is set
            if (TSQLLintToolsHelper._tsqllintToolsPath) {
                return resolve(TSQLLintToolsHelper._tsqllintToolsPath);
            }

            let tsqllintInstallDirectory: string = `${TSQLLintToolsHelper._applicationRootDirectory}/tsqllint`
            if (fs.existsSync(`${tsqllintInstallDirectory}/${TSQLLintToolsHelper._runTime}`)) {
                TSQLLintToolsHelper._tsqllintToolsPath = tsqllintInstallDirectory;
                return resolve(TSQLLintToolsHelper._tsqllintToolsPath);
            }

            // prop is not set but tsqllint is installed
            TSQLLintToolsHelper.downloadTSQLLint(tsqllintInstallDirectory).then((path: string) => {
                decompress(path, `${tsqllintInstallDirectory}`, {
                    plugins: [
                        decompressTargz()
                    ]
                }).then(() => {
                    TSQLLintToolsHelper._tsqllintToolsPath = tsqllintInstallDirectory;
                    return resolve(tsqllintInstallDirectory);
                })
            }).catch((error: Error) => {
                console.log(error)
                reject(error)
            })
        })
    }

    constructor(applicationRootDirectory: string) {
        TSQLLintToolsHelper._applicationRootDirectory = applicationRootDirectory;

        if (os.type() === 'Darwin') {
            TSQLLintToolsHelper._runTime = 'osx-x64'
        } else if (os.type() === 'Linux') {
            TSQLLintToolsHelper._runTime = 'linux-x64'
        } else if (os.type() === 'Windows_NT') {
            if (process.arch === 'ia32') {
                TSQLLintToolsHelper._runTime = 'win-x86'
            } else if (process.arch === 'x64') {
                TSQLLintToolsHelper._runTime = 'win-x64'
            }
        } else {
            throw new Error(`Invalid Platform: ${os.type()}`)
        }
    }

    static downloadTSQLLint(installDirectory: string): Promise<string> {

        console.log('Installing TSQLLint Runtime');
        
        var version = 'v1.8.10'
        var urlBase = `https://github.com/tsqllint/tsqllint/releases/download/${version}`
        var downloadUrl = `${urlBase}/${TSQLLintToolsHelper._runTime}.tgz`
        var downloadFilePath = `${installDirectory}/${TSQLLintToolsHelper._runTime}.tgz`
        var downloadPath = `${installDirectory}/${TSQLLintToolsHelper._runTime}.tgz`
        return new Promise((resolve, reject) => {
            if (!fs.existsSync(installDirectory)) {
                fs.mkdirSync(installDirectory);
            }
            var file = fs.createWriteStream(downloadFilePath)
            var request = https.get(downloadUrl, (response: any) => {
                response.pipe(file)
                file.on('finish', function () {
                    file.close(resolve(downloadPath))
                })
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