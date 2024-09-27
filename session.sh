#!/bin/bash

tmux new-session -d -s tanks

tmux split-window -v
tmux resize-pane -D 20 
tmux select-pane -U

tmux send-keys 'nvim .' C-m 

tmux select-pane -D

tmux send-keys 'docker start tanks-db-1' C-m

tmux split-window -h
tmux send-keys 'npm run server' C-m

tmux select-pane -L
tmux send-keys 'npm run client' C-m

tmux attach -t tanks
