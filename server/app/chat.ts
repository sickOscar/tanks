import axios from 'axios';

export enum ChatMessages {
    ACTION = `
 💥💥💫💥💥💫💥💥💫💥💥💫💥💥💫💥

 *Eroi! Avete una nuova azione da utilizzare!*

 💥💥💫💥💥💫💥💥💫💥💥💫💥💥💫💥
    `
}

export class Chat {
    constructor() {
    }

    static sendMessageToChat(message:ChatMessages|string, botSearch?: string): void {

        console.log(`message`, message)
        
    //
    //sendMessageToChat(message: string, botSearch?: string): void {

        if (!process.env.GIPHY_API_KEY || !process.env.GOOGLE_CHAT_WEBHOOK) {
            return;
        }

        // NON CAMBIARE IN ASYNC AWAIT che se fallisce è un casino
        axios.post(
            process.env.GOOGLE_CHAT_WEBHOOK as string,
            {text: message},
            {
                headers: {
                    'Content-Type': 'application/json; charset=UTF-8',
                },
            }
        )
            .then(() => {
                if (botSearch) {
                    const apiKey = process.env.GIPHY_API_KEY
                    axios.get(`https://api.giphy.com/v1/gifs/random?api_key=${apiKey}&tag=${botSearch}`)
                        .then(response => {
                            axios.post(
                                process.env.GOOGLE_CHAT_WEBHOOK as string,
                                {
                                    cards: [{
                                        sections: [{
                                            widgets: [{
                                                image: {
                                                    imageUrl: response.data.data.images.downsized.url,
                                                    onClick: {
                                                        openLink: {
                                                            "url": `${process.env.MAIN_DOMAIN}`
                                                        }
                                                    }
                                                }
                                            }]
                                        }]
                                    }]
                                },
                                {
                                    headers: {
                                        'Content-Type': 'application/json; charset=UTF-8',
                                    },
                                }
                            )
                                .then(() => {
                                    console.log(`Sent message: /random ${botSearch}`);
                                })
                                .catch(err => {
                                    console.log(`err`, err)
                                })

                        })
                        .catch(err => {
                            console.log(`err`, err)
                        })
                }
            })
    }
}
