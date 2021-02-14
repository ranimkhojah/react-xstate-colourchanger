import { MachineConfig, send, assign } from "xstate";
import { promptAndAsk } from "./index";
import { dmMachine } from "./dmAppointment";
import { dmMachineTodo } from "./dmTodo";
import { dmMachineTimer } from "./dmTimer";

// RASA API
const proxyurl = "https://cors-anywhere.herokuapp.com/";
const rasaurl = "https://dialogue-management.herokuapp.com/model/parse";
export const nluRequest = (text: string) =>
    fetch(new Request(proxyurl + rasaurl, {
        method: 'POST',
        headers: { 'Origin': 'http://maraev.me' }, // only required with proxy
        body: `{"text": "${text}"}`
    }))
        .then(data => data.json());


export const dmMachineMain: MachineConfig<SDSContext, any, SDSEvent> = ({
    initial: 'init',
    states: {
        init: {
            on: {
                CLICK: 'welcome'
            }
        },
        welcome: {
            on: {
            RECOGNISED: {
                target: 'statement',
                actions: assign((context) => { return { statement: context.recResult } }),
                    }
                },
            ...promptAndAsk("What would you like to do?")
        },
        statement: {
            invoke: {
            id: 'nlu',
                    src: (context, _) => nluRequest(context.statement), 
                    onDone: {
                        target: 'check_intent',
                        actions: [assign((_, event) => { return {intent: event.data.intent.name }}),
                      (_:SDSContext, event:any) => console.log(event.data)]
                    },
                    onError: {
                        target: 'welcome',
                        actions: (_,event) => console.log(event.data)
                    }
                }
        },
        check_intent: {
            entry: send('ENDSPEECH'),
            on: {
                ENDSPEECH: [
                    { target: 'appointment', cond: (context) => context.intent === 'appointment' },
                    { target: 'item', cond: (context) => context.intent === 'todo_item' },
                    { target: 'timer', cond: (context) => context.intent === 'timer' },
                    { target: 'welcome' }]
                } 
        },
        appointment: {
           ...dmMachine 
        },
        item: {
            ...dmMachineTodo
        },
        timer: {
            ...dmMachineTimer
        }
    }
})
