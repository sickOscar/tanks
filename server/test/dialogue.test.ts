const { Dialogue } = require('../app/dialogue/Dialogue')

describe("Dialogue", () => {

    describe("for", () => {
    
        it("should fail if choice does not exists", async () => {
            const dialogue = Dialogue["MERCHANT"];
            const choice = Dialogue.for(dialogue, "FAIL");
            expect(choice).resolves.toEqual({
                "exit": false,
                "failReason": 10
            })
        })

        it("should set the correct outcome in the response for outcome nodes", async () => {
            const dialogue = new Dialogue("MERCHANT");
            const choice = Dialogue.for(dialogue, "3");
            expect(choice).resolves.toEqual({
                exit: true,
                dialogue: {
                    id: "MERCHANT",
                    text: "BAR",
                    outcome: "OUTCOME",
                    options: [{ next: "exit", text: "END" }]
                }
            })
        })

        it("should return correct answer for right choice", async () => {
            const dialogue = new Dialogue("MERCHANT");
            const choice = Dialogue.for(dialogue, "0");
            expect(choice).resolves.toEqual({
                exit: true,
                dialogue: {
                    id: "MERCHANT",
                    text: "Ciao",
                    options: [{
                        text: "Si",
                        next: "3"
                    }, {
                        text: "No",
                        next: "2"
                    }]
                }
            })
        })

        

    })

})
