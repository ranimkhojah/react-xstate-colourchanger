import "./styles.scss";
import * as React from "react";
import * as ReactDOM from "react-dom";
import { Action, Machine, assign, send, State, MachineConfig } from "xstate";
import { useMachine, asEffect } from "@xstate/react";
import { inspect } from "@xstate/inspect";
import { dmMachineMain } from "./dmMain";
import { useSpeechSynthesis, useSpeechRecognition } from 'react-speech-kit';

inspect({
    url: "https://statecharts.io/inspect",
    iframe: false
});

export function promptAndAsk(prompt: string): MachineConfig<SDSContext, any, SDSEvent> {
    return ({
	initial: 'prompt',
	states: {
            prompt: {
                entry: say(prompt),
                on: { ENDSPEECH: 'ask' }
            },
            ask: {
		        entry: send('LISTEN'),
            }
	}})
}

export function say(text: string): Action<SDSContext, SDSEvent> {
    return send((_context: SDSContext) => ({ type: "SPEAK", value: text }))
}

export function listen(): Action<SDSContext, SDSEvent> {
    return send('LISTEN')
}


const machine = Machine<SDSContext, any, SDSEvent>({
    id: 'root',
    type: 'parallel',
    states: {
        dm: {
            ...dmMachineMain
        },
        asrtts: {
            initial: 'idle',
            states: {
                idle: {
                    on: {
                        LISTEN: 'recognising',
                        SPEAK: {
                            target: 'speaking',
                            actions: assign((_context, event) => { return { ttsAgenda: event.value } })
                        }
                    }
                },
                recognising: {
		    initial: 'progress',
                    entry: 'recStart',
                    exit: 'recStop',
                    on: {
                        ASRRESULT: {
                            actions: ['recLogResult',
                                assign((_context, event) => { return { recResult: event.value } })],
                            target: '.match'
                        },
                        RECOGNISED: 'idle'
                    },
                    states: {
		    	progress: {
			},	    					
                        match: {
                            entry: send('RECOGNISED'),
                        },
                    }
                },
                speaking: {
                    entry: 'ttsStart',
                    on: {
                        ENDSPEECH: 'idle',
                    }
                }
            }
        }
    },
},
    {
        actions: {
            recLogResult: (context: SDSContext) => {
                /* context.recResult = event.recResult; */
                console.log('<< ASR: ' + context.recResult);
            },
            test: () => {
                console.log('test')
            },
            logIntent: (context: SDSContext) => {
                /* context.nluData = event.data */
                console.log('<< NLU intent: ' + context.nluData.intent.name)
            }
        },
    });



interface Props extends React.HTMLAttributes<HTMLElement> {
    state: State<SDSContext, any, any, any>;
}
const ReactiveButton = (props: Props): JSX.Element => {
    switch (true) {
        case props.state.matches({ asrtts: 'recognising' }):
            return (
                <button type="button" className="glow-on-hover"
                    style={{ animation: "glowing 20s linear" }} {...props}>
                    Listening...
                </button>
            );
        case props.state.matches({ asrtts: 'speaking' }):
            return (
                <button type="button" className="glow-on-hover"
                    style={{ animation: "bordering 1s infinite" }} {...props}>
                    Speaking...
                </button>
            );
        default:
            return (
                <button type="button" className="glow-on-hover" {...props}>
                    Click to start
                </button >
            );
    }
}

function App() {
    const { speak, cancel, speaking } = useSpeechSynthesis({
        onEnd: () => {
            send('ENDSPEECH');
        },
    });
    const { listen, listening, stop } = useSpeechRecognition({
        onResult: (result: any) => {
            send({ type: "ASRRESULT", value: result });
        },
    });
    const [current, send, service] = useMachine(machine, {
        devTools: true,
        actions: {
            recStart: asEffect(() => {
                console.log('Ready to receive a color command.');
                listen({
                    interimResults: false,
                    continuous: true
                });
            }),
            recStop: asEffect(() => {
                console.log('Recognition stopped.');
                stop()
            }),
            changeColour: asEffect((context) => {
                console.log('Repainting...');
                document.body.style.background = context.recResult;
            }),
            ttsStart: asEffect((context, effect) => {
                console.log('Speaking...');
                speak({ text: context.ttsAgenda })
            }),
            ttsCancel: asEffect((context, effect) => {
                console.log('TTS STOP...');
                cancel()
            })
            /* speak: asEffect((context) => {
	     * console.log('Speaking...');
             *     speak({text: context.ttsAgenda })
             * } */
        }
    });


    return (
        <div className="App">
            <ReactiveButton state={current} onClick={() => send('CLICK')} />
        </div>
    )
};


const rootElement = document.getElementById("root");
ReactDOM.render(
    <App />,
    rootElement);