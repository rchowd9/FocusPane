import asyncio
import random
import time
from typing import List
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel

app = FastAPI(title="FocusPane SCADA Engine")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class AlarmEvent(BaseModel):
    id: str
    tag: str
    description: str
    raw_severity: str
    impact_score: float
    timestamp: float
    status: str

# Mock SCADA tag topology map
TAG_CATALOG = [
    {"tag": "PUMP-101A", "desc": "Feed Water Pump High Vibration", "base_impact": 0.85},
    {"tag": "VALVE-204", "desc": "Main Steam Line Pressure Relief Open", "base_impact": 0.92},
    {"tag": "TEMP-302", "desc": "Reactor Vessel Core Temp High", "base_impact": 0.98},
    {"tag": "FLOW-105", "desc": "Coolant Loop Low Flow Rate", "base_impact": 0.74},
    {"tag": "ELEC-401", "desc": "Substation B Bus Voltage Sag", "base_impact": 0.60},
]

def calculate_impact_score(base_impact: float) -> float:
    """Simulates a LightGBM gradient boosted impact scoring model."""
    noise = random.uniform(-0.05, 0.05)
    return round(max(0.1, min(1.0, base_impact + noise)), 2)

@app.get("/api/health")
def health_check():
    return {"status": "online", "engine": "FocusPane Correlation Core"}

@app.websocket("/ws/alarms")
async def websocket_alarm_stream(websocket: WebSocket):
    await websocket.accept()
    event_id = 1000
    try:
        while True:
            await asyncio.sleep(3.0)  # Stream new simulated event every 3s
            tag_data = random.choice(TAG_CATALOG)
            event_id += 1
            
            event = AlarmEvent(
                id=f"EVT-{event_id}",
                tag=tag_data["tag"],
                description=tag_data["desc"],
                raw_severity=random.choice(["CRITICAL", "HIGH", "WARNING"]),
                impact_score=calculate_impact_score(tag_data["base_impact"]),
                timestamp=time.time(),
                status="ACTIVE"
            )
            await websocket.send_json(event.model_dump())
    except WebSocketDisconnect:
        print("Client disconnected from alarm stream.")
