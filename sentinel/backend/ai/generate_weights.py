"""Run once to save random-weight checkpoint for demo."""
import torch, os
from seismic_cnn import SentinelCNN

model = SentinelCNN()
out_path = os.path.join(os.path.dirname(__file__), "sentinel_cnn.pth")
torch.save(model.state_dict(), out_path)
print(f"Saved random weights to {out_path}")
