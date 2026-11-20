import {createServer} from 'node:http';
import {resolve} from 'node:path';
import {application,config,openStore,root,telegramClient} from './app.mjs';
const cfg=config(process.env);
const db=openStore(process.env.DATABASE_PATH||resolve(root,'data/game.sqlite'));
const server=createServer(application(cfg,db,telegramClient(cfg)));
server.requestTimeout=20000;
server.listen(Number(process.env.PORT||8080),'0.0.0.0',()=>console.log('VDVOЁМ server ready'));
