"""Training script for SentryCNN seismic magnitude model.

Usage:
    python -m backend.ml.train --epochs 50 --batch-size 32
"""

import argparse
import logging
import os
import time

import numpy as np

logger = logging.getLogger(__name__)

MODEL_PATH = os.path.join(os.path.dirname(__file__), "..", "ai", "sentinel_cnn.pth")


def train(epochs: int = 50, batch_size: int = 32, lr: float = 1e-3, n_samples: int = 2000) -> dict:
    """Train the SentryCNN model on synthetic data.

    Returns:
        Training summary dict with final loss, duration, model path.
    """
    try:
        import torch
        import torch.nn as nn
        from torch.utils.data import DataLoader, TensorDataset
    except ImportError:
        logger.error("PyTorch not installed. Run: pip install torch")
        return {"error": "PyTorch not installed"}

    from backend.ai.seismic_cnn import SentryCNN
    from backend.ml.synthetic_data import generate_dataset

    device = torch.device("cuda" if torch.cuda.is_available() else "cpu")
    logger.info("[train] Using device: %s", device)

    # Generate training data
    logger.info("[train] Generating %d synthetic waveforms...", n_samples)
    waveforms, magnitudes = generate_dataset(n_samples=n_samples)

    # Split 80/20
    split = int(0.8 * n_samples)
    train_x = torch.tensor(waveforms[:split])
    train_y = torch.tensor(magnitudes[:split]).unsqueeze(1)
    val_x = torch.tensor(waveforms[split:])
    val_y = torch.tensor(magnitudes[split:]).unsqueeze(1)

    train_loader = DataLoader(TensorDataset(train_x, train_y), batch_size=batch_size, shuffle=True)
    val_loader = DataLoader(TensorDataset(val_x, val_y), batch_size=batch_size)

    model = SentryCNN().to(device)
    optimizer = torch.optim.Adam(model.parameters(), lr=lr)
    criterion = nn.MSELoss()

    t0 = time.perf_counter()
    best_val_loss = float("inf")

    for epoch in range(epochs):
        model.train()
        train_loss = 0.0
        for batch_x, batch_y in train_loader:
            batch_x, batch_y = batch_x.to(device), batch_y.to(device)
            optimizer.zero_grad()
            pred = model(batch_x)
            loss = criterion(pred, batch_y)
            loss.backward()
            optimizer.step()
            train_loss += loss.item() * batch_x.size(0)

        train_loss /= len(train_loader.dataset)

        # Validation
        model.eval()
        val_loss = 0.0
        with torch.no_grad():
            for batch_x, batch_y in val_loader:
                batch_x, batch_y = batch_x.to(device), batch_y.to(device)
                pred = model(batch_x)
                val_loss += criterion(pred, batch_y).item() * batch_x.size(0)
        val_loss /= len(val_loader.dataset)

        if val_loss < best_val_loss:
            best_val_loss = val_loss
            torch.save(model.state_dict(), MODEL_PATH)

        if (epoch + 1) % 10 == 0 or epoch == 0:
            logger.info("[train] Epoch %d/%d — train_loss=%.4f val_loss=%.4f", epoch + 1, epochs, train_loss, val_loss)

    elapsed = time.perf_counter() - t0
    logger.info("[train] Training complete in %.1fs. Best val loss: %.4f", elapsed, best_val_loss)
    logger.info("[train] Model saved to %s", MODEL_PATH)

    return {
        "epochs": epochs,
        "best_val_loss": round(best_val_loss, 4),
        "duration_s": round(elapsed, 1),
        "model_path": MODEL_PATH,
        "device": str(device),
    }


if __name__ == "__main__":
    logging.basicConfig(level=logging.INFO)
    parser = argparse.ArgumentParser(description="Train SentryCNN")
    parser.add_argument("--epochs", type=int, default=50)
    parser.add_argument("--batch-size", type=int, default=32)
    parser.add_argument("--lr", type=float, default=1e-3)
    parser.add_argument("--samples", type=int, default=2000)
    args = parser.parse_args()

    result = train(epochs=args.epochs, batch_size=args.batch_size, lr=args.lr, n_samples=args.samples)
    print(result)
