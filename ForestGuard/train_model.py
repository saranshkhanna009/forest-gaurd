import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.preprocessing import StandardScaler
from sklearn.metrics import accuracy_score
import xgboost as xgb
import pickle

def create_synthetic_data(num_samples=3000):
    np.random.seed(42)
    
    # Base Weather Params
    temperature = np.random.normal(30, 10, num_samples) # -5 to 50
    humidity = np.random.normal(50, 25, num_samples) # 0 to 100
    wind_speed = np.random.normal(15, 15, num_samples) # 0 to 80
    rainfall = np.random.exponential(10, num_samples) # mm
    soil_moisture = np.random.normal(40, 20, num_samples) # %
    
    # Topography & GIS
    forest_cover = np.random.uniform(0, 100, num_samples) # %
    elevation = np.random.normal(1000, 800, num_samples) # meters
    road_distance = np.random.exponential(5000, num_samples) # meters (distance to nearest road)
    
    # Synthetics (NDVI, Leaf Litter, Fire History)
    # NDVI (0 to 1) - higher correlates with high forest cover and high soil moisture
    ndvi_base = (forest_cover / 100) * 0.7 + (soil_moisture / 100) * 0.3
    ndvi_noise = np.random.normal(0, 0.1, num_samples)
    ndvi = np.clip(ndvi_base + ndvi_noise, 0.0, 1.0)
    
    # Leaf Litter Index (0 to 1) - accumulates when it's dry and highly forested
    leaf_litter = np.clip((forest_cover / 100) * 0.6 + ((100 - soil_moisture) / 100) * 0.4 + np.random.normal(0, 0.1, num_samples), 0.0, 1.0)
    
    # Fire History (0 to 10) - propensity for fires purely historically
    fire_history = np.clip(np.random.poisson(2, num_samples) + (temperature / 10), 0, 10)

    # Clean bounds
    humidity = np.clip(humidity, 0, 100)
    wind_speed = np.clip(wind_speed, 0, 150)
    soil_moisture = np.clip(soil_moisture, 0, 100)
    elevation = np.clip(elevation, 0, 8000)
    
    # Calculating a robust heuristic for 'True Risk' to train the model on:
    # High risk heavily relies on: High Temp, Low Humidity, High Wind, Low Rain, Low Soil Moisture, High Forest Cover, High Leaf Litter.
    
    risk_score = (
        (temperature / 50) * 0.20 +
        ((100 - humidity) / 100) * 0.15 +
        (wind_speed / 100) * 0.10 +
        (forest_cover / 100) * 0.25 + 
        (leaf_litter) * 0.10 +
        ((100 - soil_moisture) / 100) * 0.10 +
        (fire_history / 10) * 0.05 +
        (road_distance / 20000) * 0.05 # Far roads = slightly higher risk due to lack of intervention
    )
    
    # If there is zero forest cover, risk is inherently low.
    risk_score = np.where(forest_cover < 5, risk_score * 0.1, risk_score)
    # If recent rain is very high, risk drastically reduces
    risk_score = np.where(rainfall > 20, risk_score * 0.3, risk_score)
    
    y = []
    for score in risk_score:
        if score > 0.65:
            y.append(2) # High
        elif score > 0.45:
            y.append(1) # Medium
        else:
            y.append(0) # Low

    X = pd.DataFrame({
        'Temperature': temperature,
        'Humidity': humidity,
        'Wind_Speed': wind_speed,
        'Rainfall_7d': rainfall,
        'Soil_Moisture': soil_moisture,
        'Forest_Cover': forest_cover,
        'NDVI': ndvi,
        'Fire_History': fire_history,
        'Elevation': elevation,
        'Road_Distance': road_distance,
        'Leaf_Litter_Index': leaf_litter
    })
    
    return X, np.array(y)

if __name__ == '__main__':
    print("Generating 11-feature synthetic dataset...")
    X, y = create_synthetic_data(5000)
    
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    scaler = StandardScaler()
    X_train_scaled = scaler.fit_transform(X_train)
    X_test_scaled = scaler.transform(X_test)
    
    print("Training XGBoost Classifier...")
    model = xgb.XGBClassifier(
        n_estimators=100, 
        max_depth=6, 
        learning_rate=0.1,
        random_state=42,
        use_label_encoder=False,
        eval_metric='mlogloss'
    )
    model.fit(X_train_scaled, y_train)
    
    y_pred = model.predict(X_test_scaled)
    acc = accuracy_score(y_test, y_pred)
    print(f"Model Accuracy: {acc * 100:.2f}%")
    
    with open('model.pkl', 'wb') as f:
        pickle.dump(model, f)
        
    with open('scaler.pkl', 'wb') as f:
        pickle.dump(scaler, f)
        
    print("Saved 11-feature 'model.pkl' and 'scaler.pkl' successfully.")
