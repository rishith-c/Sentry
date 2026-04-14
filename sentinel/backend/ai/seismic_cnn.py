import os, time, logging
import numpy as np
import torch
import torch.nn as nn

logger = logging.getLogger(__name__)

AMD_GPU_AVAILABLE = os.environ.get("AMD_GPU_AVAILABLE", "0") == "1"
DEVICE = torch.device("cuda") if AMD_GPU_AVAILABLE else torch.device("cpu")
WEIGHTS_PATH = os.path.join(os.path.dirname(__file__), "sentinel_cnn.pth")

class SentinelCNN(nn.Module):
    def __init__(self):
        super().__init__()
        self.conv1 = nn.Conv1d(3, 32, kernel_size=11, padding=5)
        self.bn1   = nn.BatchNorm1d(32)
        self.conv2 = nn.Conv1d(32, 64, kernel_size=7, padding=3)
        self.bn2   = nn.BatchNorm1d(64)
        self.pool  = nn.AdaptiveAvgPool1d(50)
        self.fc1   = nn.Linear(64 * 50, 128)
        self.drop  = nn.Dropout(0.3)
        self.fc2   = nn.Linear(128, 1)
        self.relu  = nn.ReLU()

    def forward(self, x):
        x = self.relu(self.bn1(self.conv1(x)))
        x = self.relu(self.bn2(self.conv2(x)))
        x = self.pool(x)
        x = x.view(x.size(0), -1)
        x = self.relu(self.fc1(x))
        x = self.drop(x)
        return self.fc2(x).squeeze(-1)

def load_model() -> SentinelCNN:
    model = SentinelCNN().to(DEVICE)
    if os.path.exists(WEIGHTS_PATH):
        model.load_state_dict(torch.load(WEIGHTS_PATH, map_location=DEVICE))
        logger.info(f"Loaded pretrained weights from {WEIGHTS_PATH}")
    else:
        logger.warning("WARNING: using random weights — inference magnitude will be imprecise but pipeline will function")
    model.eval()
    return model

def run_inference(waveform: np.ndarray) -> float:
    # Accept (3, N) — pad or truncate to (3, 500)
    if waveform.shape[1] < 500:
        waveform = np.pad(waveform, ((0,0),(0, 500 - waveform.shape[1])))
    else:
        waveform = waveform[:, :500]
    tensor = torch.tensor(waveform, dtype=torch.float32).unsqueeze(0).to(DEVICE)
    t0 = time.time()
    with torch.no_grad():
        out = load_model()(tensor)
    ms = (time.time() - t0) * 1000
    logger.info(f"CNN inference time: {ms:.1f}ms")
    return float(out.item())
