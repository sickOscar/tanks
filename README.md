If you wish to look at the code, please wash your eyes before and after.

# Dragons

Be ready adventurer, this is not for the faint of heart. 

You will be asked to make decisions that will shape the destiny of the realm.

Are you ready to stab some friends in the back?

### Development

Ask me for the current .env file, and then:

```
npm i
make dev
```

Docker needed

If you need live reload on save, run

```
npm run db
npm run dev
npm run client 
```

### Contribution
Feel free to contribute to the project by opening a pull request.
### License

This project is licensed under the MIT License.

## Dialogue

### Yaml structure

```yaml
label:
    text: "Put your NPC message here"
    options:
        - text: "Question ?"      # Option text
          next: destinationLabel1 # destination label for option 1
        - text: "Another question or another answer?" 
          next: destinationLabel2
    alias: "nodealiasname" # in place of label if label is a hash
    next: destinationLabel # A NPC could answer and jump to a section (options skipped)
    description: "text" # if you feel the urge to explain something to yourself
    outcome: ARTIFACT_1 # tags rapresenting artifacts, goods, bonuses, ... someting Player gain
```

### Generate yaml from Excalidraw

Create a beatiful tree graph rapresenting your dialogues with Excalidraw

Ellipsis are start or ending points with special meaning: START, END and SUCCESS
Recatangles are nodes with NPC dialogue
Diamonds are the Player choices

A nice sample can be found inside <project_dir>/data

Save excalidraw locally then run to produce a usefull yaml 

```
python3 ./bin/dialogueparser.py <dir_or_file.excalidraw>
```

Finally replace excalidraw ids with meaninfull human labels
