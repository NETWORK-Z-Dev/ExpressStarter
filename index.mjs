import express from "express";
import fs from "fs";
import path from "path";
import {Server} from "socket.io";
import {fileTypeFromBuffer} from "file-type";
import {fileURLToPath} from "url";
import http from "http";

import Logger from "@hackthedev/terminal-logger"
import ArrayTools from "@hackthedev/arraytools"

export default class ExpressStarter {
    constructor() {
        console.clear();
        this.version = 1
        this.debug = false
        this.dirname = process.cwd();
        this.app = express();

        process.stdin.resume();
        process.stdin.setEncoding("utf8");
    }

    registerErrorHandlers(){
        // Catch uncaught errors
        process.on("uncaughtException", function (err) {
            // Handle the error safely
            Logger.error("UNEXPECTED ERROR");
            Logger.error(err.message);
            Logger.error("Details: ");
            Logger.error(err.stack);
        });

        process.on("unhandledRejection", (reason) => {
            Logger.error("UNHANDLED PROMISE REJECTION");
            Logger.error(reason?.stack || reason);
        });
    }

    onProcessInput(callback){
        if(!callback || typeof callback !== "function") throw new Error("Callback function is required")

        process.stdin.on("data", function (text) {
            var data = text.trim();
            var args = data.split(" ");

            callback(args);
        });

    }

    setVersion(version) {
        if (!version) throw new Error("Version is required")
        this.version = version
    }

    startHttpServer(port, onStarted = null){
        Logger.warn("Starting HTTP Server on port " + port);

        this.server = http.createServer(this.app);
        this.server.listen(port, async function () {
            Logger.success("Server is running on port " + port);
            if(onStarted) await onStarted();
        })
    }

    getStartupArgs() {
        return process.argv.slice(2);
    }

    async getLatestVersion(repo){
        if(!repo) throw new Error("Repo is required. Example: username/reponame")

        return new Promise(async (resolve, reject) => {
            var versionUrl = `https://raw.githubusercontent.com/${repo}/main/version`;
            const res = await fetch(versionUrl);
            if (res.status !== 200) return null;
            resolve((await res.text()).trim());
        });
    }

    registerTemplateMiddleware({
                                   publicWebDir = null,
                                   getExtensions = null,
                                   getPlaceholders = null
                               } = {}) {

        // set defaults
        if(!publicWebDir) publicWebDir = path.join(this.dirname, "public")
        if(!fs.existsSync(publicWebDir)) fs.mkdirSync(publicWebDir, {recursive: true});
        let templateExtensions = ['.html', '.js']

        const renderTemplate = async (template, req) => {
            let query = req.query;

            let placeholders = [
                ["version", () => this.version],
            ];


            // merge with custom ones
            if(getPlaceholders){
                let customPlaceholderArray = await getPlaceholders(req);
                placeholders = ArrayTools.merge(placeholders, customPlaceholderArray);
            }

            // merge with custom ones
            if(getExtensions){
                let customExtensionsArray = await getExtensions(req);
                templateExtensions = ArrayTools.merge(templateExtensions, customExtensionsArray);
            }

            return template.replace(/{{\s*([^{}\s]+)\s*}}/g, (match, key) => {
                const found = placeholders.find(([name]) => name === key);
                return found ? found[1]() : '';
            });
        }

        this.app.use(async (req, res, next) => {
            let reqPath = req.path === '/' ? '/index.html' : req.path;
            const ext = path.extname(reqPath).toLowerCase();

            if (!templateExtensions.includes(ext)) return next();

            const fullPath = path.join(publicWebDir, reqPath);

            fs.readFile(fullPath, 'utf8', async (err, content) => {
                if (err) return next();

                const rendered = await renderTemplate(content, req);
                const contentType = {
                    '.html': 'text/html',
                    '.js': 'application/javascript',
                }[ext] || 'text/plain';

                res.setHeader('Content-Type', contentType);
                res.send(rendered);
            });
        });
    }
}