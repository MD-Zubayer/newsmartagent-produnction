


def processor_spreadsheet_data(all_grid_data, user_text):

    col_name_to_idx = {}
    important_col_indices = []
    user_text_lower = user_text.lower()

    # 1. Create a pen map from the header row (row 0)
    for key, value in all_grid_data.items():
        if key.startswith('0-'):
            c_idx = key.split('-')[1]
            col_name = str(value).strip().lower()
            clean_name = col_name.replace('*', '')
            col_name_to_idx[clean_name] = c_idx
            if '*' in col_name:
                important_col_indices.append(c_idx)
    
    dynamic_extra_cols = [
        idx for name, idx in col_name_to_idx.items()
        if name in user_text_lower and len(name) > 2
    ]

    final_col_indices = set(important_col_indices + dynamic_extra_cols)

    rows_dict = {}
    al_values_for_matching = set()

    for k, v in all_grid_data.items():
        if not v: continue
        r_idx, c_idx = k.split('-')

        if c_idx in final_col_indices:
            if r_idx not in rows_dict:
                rows_dict[r_idx] = []

            rows_dict[r_idx].append(str(v).replace('*', ''))

            if c_idx in important_col_indices and len(str(v)) > 4:
                al_values_for_matching.update(str(v).lower().split())


    return rows_dict, al_values_for_matching




def prepare_vactor_data(grid_data):
    headers = {}

    for key, value in grid_data.items():
        if key.startswith('0-'):
            col_idx = key.split('-')[1]
            headers[col_idx] = value.replace("*", "").strip()
    row_sentences = {}
    for key, value in grid_data.items():
        r_idx, c_idx = key.split('-')
        if r_idx == "0": continue

        if r_idx not in row_sentences:
            row_sentences[r_idx] = []

        col_name = headers.get(c_idx, f"col_{c_idx}")
        if value.strip():
            row_sentences[r_idx].append(f"{col_name.capitalize()}: {value}")
    
    return {r: ", ".join(parts) for r, parts in row_sentences.items()}

