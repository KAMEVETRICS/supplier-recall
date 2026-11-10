import type {AppConfig} from '@/server/config';
import {createWalrus} from './walrus';
import {createTatum} from './tatum';
import {createTavily} from './tavily';
import {createLlm} from './llm';
import type {Providers} from './contracts';
export function createProviders(config:AppConfig):Providers{return {memory:createWalrus(config),payment:createTatum(config.tatumKey),search:createTavily(config.tavilyKey),llm:createLlm(config.openaiKey,config.model)};}
