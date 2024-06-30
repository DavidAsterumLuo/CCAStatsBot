import pandas as pd

def split_csv(input_file, output_file):
    # Read the input CSV file
    df = pd.read_csv(input_file)

    # Columns for player data
    player_columns = [
        'Splashtag', 'Weapon', 'KA', 'Deaths', 'Assists',
        'Special', '#Specials', 'Paint'
    ]

    # Create a list to hold the new rows
    rows = []

    # Iterate through each row in the input dataframe
    for index, row in df.iterrows():
        # General game information that will be the same for each player
        general_info = row[['SubmittedBy', 'SubmittedAt', 'MatchID', 'MatchDateTime', 'Timer', 'Map', 'Mode', 'Team 1 Score', 'Team2 Score']]

        # Process each player's data (P1 to P8)
        for i in range(1, 9):
            # Calculate the column index for each player
            start_idx = 9 + (i - 1) * len(player_columns)
            # Extract player-specific data from the row
            player_data = row.iloc[start_idx:start_idx + len(player_columns)]

            # Determine the team for the player
            team = 1 if i <= 4 else 2

            # Combine general info, team, and player data
            new_row = general_info.tolist() + [team] + player_data.tolist()

            # Add the new row to the list
            rows.append(new_row)

    # Create a new DataFrame from the rows list
    columns = ['SubmittedBy', 'SubmittedAt', 'MatchID', 'MatchDateTime', 'Timer', 'Map', 'Mode', 'Team 1 Score', 'Team2 Score', 'Team'] + player_columns
    new_df = pd.DataFrame(rows, columns=columns)

    # Save the new DataFrame to a CSV file
    new_df.to_csv(output_file, index=False)

# File paths
input_file = 'input.csv'
output_file = 'output.csv'

# Split the CSV
split_csv(input_file, output_file)
