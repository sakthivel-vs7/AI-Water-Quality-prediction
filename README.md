# AquaSense AI

## AI-Based Water Quality Prediction Using IoT Sensor Time-Series



### Project Overview

AquaSense AI is a prototype application designed to monitor water-quality sensor readings using machine learning. It combines a React dashboard, FastAPI backend, PostgreSQL database, and machine-learning models.



The system supports water-quality classification, sensor anomaly detection, time-series forecasting, CSV uploads, and alert management.



### Technologies Used

\- \*\*Frontend:\*\* React, Vite, Axios, Recharts

\- \*\*Backend:\*\* Python, FastAPI

\- \*\*Database:\*\* PostgreSQL, SQLAlchemy

\- \*\*Machine Learning:\*\* Scikit-learn

\- \*\*Data Processing:\*\* Pandas, NumPy



### Key Features

1\. Water-quality monitoring dashboard.

2\. Sensor reading storage and visualization.

3\. CSV sensor-data upload.

4\. Random Forest water-quality classification.

5\. Isolation Forest anomaly detection.

6\. Random Forest time-series forecasting.

7\. Sensor threshold alerts.

8\. Alert acknowledgement and resolution.



### Sensors Monitored

\- pH

\- Temperature

\- Turbidity

\- Dissolved Oxygen

\- Electrical Conductivity

\- Total Dissolved Solids (TDS)

\- Oxidation-Reduction Potential (ORP)



### Project Structure

```text

AI-Water-Quality-Prediction/

├── backend/

│   ├── main.py

│   ├── database.py

│   ├── model.py

│   ├── schemas.py

│   ├── requirements.txt

│   └── .env.example

├── frontend/

│   ├── public/

│   ├── src/

│   ├── package.json

│   └── vite.config.js

├── ml/

│   ├── generate\_dataset.py

│   ├── train\_model.py

│   ├── predict.py

│   ├── anomaly\_detection.py

│   ├── train\_forecasting.py

│   └── model and dataset files

└── README.md

```



### Requirements

\- Python 3.10 or later

\- Node.js and npm

\- PostgreSQL



### Installation and Setup



#### 1. Configure the database

Create a PostgreSQL database.



Copy `backend/.env.example` to `backend/.env` and enter your own database credentials.



Example:

```env

DB\_USER=your\_postgres\_username

DB\_PASSWORD=your\_postgres\_password

DB\_HOST=localhost

DB\_PORT=5432

DB\_NAME=your\_database\_name

```



Do not upload your actual `.env` file to GitHub.



#### 2. Set up the backend

From the project root:



```bash

python -m venv .venv

```



Activate on Windows:



```powershell

.\\.venv\\Scripts\\Activate.ps1

```



Install dependencies:



```bash

pip install -r backend/requirements.txt

```



Start the backend:



```bash

cd backend

uvicorn main:app --reload

```



Backend URL: http://127.0.0.1:8000



API documentation: http://127.0.0.1:8000/docs



#### 3. Set up the frontend

Open another terminal:



```bash

cd frontend

npm install

npm run dev

```



Frontend URL: http://localhost:5173



### Machine Learning Models



| Model | Purpose |

|---|---|

| Random Forest Classifier | Water-quality classification |

| Isolation Forest | Sensor anomaly detection |

| Random Forest Regressor | Next-step sensor forecasting |



The forecasting model uses six previous readings to predict the next sensor values at a five-minute interval.



### Forecasting Model Evaluation



Evaluation was performed using a chronological split of the synthetic dataset.



| Sensor | MAE | RMSE | R² |

|---|---:|---:|---:|

| pH | 0.1323 | 0.1660 | 0.5783 |

| Turbidity | 0.4626 | 0.5705 | -0.1434 |

| TDS | 9.4851 | 11.8675 | 0.5527 |

| Conductivity | 12.2748 | 15.3555 | 0.6218 |

| Dissolved Oxygen | 0.3445 | 0.4221 | -0.0900 |

| Temperature | 1.2344 | 1.4672 | 0.2011 |

| ORP | 13.9304 | 17.2734 | 0.4217 |



Negative R² values for turbidity and dissolved oxygen indicate that the model did not outperform a mean-value baseline for those variables on the test data.



### Limitations

\- The current dataset contains synthetic demonstration readings, not certified laboratory measurements.

\- Forecasting is a one-step-ahead prediction.

\- Model performance varies across sensor parameters.

\- Alert thresholds are configurable prototype values, not certified regulatory limits.

\- An anomaly indicates an unusual sensor pattern; it does not prove water contamination.

\- This prototype is intended for demonstration and decision support, not as a replacement for laboratory testing.

\- Physical IoT hardware and live MQTT integration are not claimed as verified features.



### Project Objective

To develop an AI-assisted water-quality monitoring prototype integrating sensor-data processing, machine-learning classification, anomaly detection, time-series forecasting, database storage, and dashboard visualization.



### Author

\*\*Sakthivel V. S.\*\*



AI Developer Intern Project  

Nano Spark


