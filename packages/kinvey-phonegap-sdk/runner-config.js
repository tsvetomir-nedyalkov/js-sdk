const path = require('path');
const walk = require('klaw-sync');
const fs = require('fs-extra');

const {
    Runner,
    tasks: {
        logServer,
        copy,
        copyTestRunner,
        copyTestLibs,
        runCommand,
        remove,
        processTemplateFile
    },
    conditionals: {
        when
    }
} = require('kinvey-universal-runner');

const appName = 'KinveyCordovaTestApp';
const appRootPath = path.join(__dirname, appName);
const appPath = path.join(appRootPath, 'www');
const appTestsPath = path.join(appPath, 'tests');
const shimTestsPath = path.join(__dirname, 'test', 'tests');
const rootMonoRepoPath = path.join(__dirname, '../../');
const commonTestsPath = path.join(rootMonoRepoPath, 'test', 'integration');
const distPath = path.join(__dirname, 'dist');
let logServerPort;


function runPipeline(osName) {

    const runner = new Runner({
        pipeline: [
            remove(distPath),
            remove(appRootPath),
            runCommand({
                command: 'npm',
                args: ['run', 'build'],
                cwd: rootMonoRepoPath
            }),
            runCommand({
                command: 'cordova',
                args: ['create', appName],
                cwd: __dirname
            }),
            copy(path.join(__dirname, 'test', 'template'), appPath),
            copy(distPath, appPath),
            copy(
                shimTestsPath,
                appTestsPath
            ),
            copy(
                commonTestsPath,
                appTestsPath
            ),
            processTemplateFile(
                path.join(appPath, 'index.template.hbs'),
                () => ({
                    tests: walk(path.join(appPath, 'tests'), {
                        nodir: true
                    }).map(f => `./${path.relative(appPath, f.path)}`),
                    logServerPort
                }),
                path.join(appPath, 'index.html')
            ),
            copyTestRunner(appPath),
            runCommand({
                command: 'cordova',
                args: ['platform', 'add', osName],
                cwd: appRootPath
            })
        ]
    });


    runner.on('log.start', port => (logServerPort = port));

    runner
        .run()
        .then(() => console.log('done'))
        .catch(err => console.log(err));
}

module.exports = runPipeline;
