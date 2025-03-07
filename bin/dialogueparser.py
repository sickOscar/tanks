import os
import json
import yaml

def load_excalidraw_file(filepath):
    with open(filepath, "r", encoding="utf-8") as file:
        return json.load(file)

def find_elements(elements):
    nodes = {}
    edges = {}
    text_map = {}
    options = {}

    # extract elements text
    for element in elements:
        if element["type"] == "text":
            text_map[element["containerId"]] = element.get("originalText", "ERROR TEXT FIELD").strip()


    for element in elements:

        print("Element: "+ element["id"] + " " + element["type"])

        element_id = element["id"]
        text = text_map.get(element_id, "ERROR TEXT MAP NOT FOUND")


        if element["type"] == "ellipse" and text in {"START", "SUCCESS", "END"}:
            nodes[element_id] = { "text": text, "options": []}

        elif element["type"] == "diamond":
            options[element_id] = {"text": text}

        elif element["type"] == "rectangle":
            nodes[element_id] = { "text": text, "options": [], "alias": f"node_{len(nodes)}"}

        # Connections
        elif element["type"] == "arrow":
            start_id = element["startBinding"]["elementId"]
            end_id = element["endBinding"]["elementId"]

            if not start_id in edges:
                edges[start_id] = []

            edges[start_id].append((start_id, end_id))

    return nodes, edges, options

def build_graph(nodes, edges, options):

    for start_id, tuples in edges.items():
        for n_start_id, n_end_id in tuples:
            if n_start_id in nodes and n_end_id in options: # da nodo a opzione
                if len(edges[n_end_id]) > 1: # prendo la freccia che va da n_end_id e che dovrebbe avere una sola tupla
                    raise ValueError("Too many destinations")

                next_start_id, next_end_id = edges[n_end_id][0] # brain f@#k

                nodes[start_id]["options"].append({"text": options[n_end_id]["text"], "next": next_end_id})

    return nodes

def parse_excalidraw(filepath):
    data = load_excalidraw_file(filepath)
    elements = data.get("elements", [])

    nodes, edges, options = find_elements(elements)
    graph = build_graph(nodes, edges, options)
    return graph

def save_yaml(data, output_path):
    with open(output_path, "w", encoding="utf-8") as file:
        yaml.dump(data, file, allow_unicode=True, default_flow_style=False, sort_keys=False)

def process_input(path):
    if os.path.isdir(path):
        files = [os.path.join(path, f) for f in os.listdir(path) if f.endswith(".excalidraw")]
    elif os.path.isfile(path) and path.endswith(".excalidraw"):
        files = [path]
    else:
        raise ValueError("Invalid input path")

    for file in files:
        graph = parse_excalidraw(file)
        yaml_path = file.replace(".excalidraw", ".yaml")
        save_yaml(graph, yaml_path)
        print(f"Processed: {file} -> {yaml_path}")

if __name__ == "__main__":
    import sys
    if len(sys.argv) < 2:
        print("Usage: python script.py <path_to_file_or_directory>")
    else:
        process_input(sys.argv[1])
