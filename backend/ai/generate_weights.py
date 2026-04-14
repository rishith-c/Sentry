"""Generate and save initial CNN weights for demo/testing."""

import torch

from backend.ai.seismic_cnn import SentryCNN

if __name__ == "__main__":
    model = SentryCNN()
    torch.save(model.state_dict(), "backend/ai/sentinel_cnn.pth")
    print("Saved pretrained weights to backend/ai/sentinel_cnn.pth")
