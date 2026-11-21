"""
Transfer-learning script using MobileNetV2 (ImageNet weights) to train the PlantCare
model on a local PlantVillage dataset subset (Tomato, Potato, Pepper) and export:
  - models/plant_disease_model.keras
  - models/class_names.json

Usage:
  python ml/train_mobilenetv2.py --data-dir path/to/plantvillage_subset --epochs 10
"""

import argparse
import json
import os

import tensorflow as tf


def build_and_train(data_dir: str, epochs: int, batch_size: int, output_dir: str) -> None:
    if not os.path.isdir(data_dir):
        raise FileNotFoundError(f"Dataset directory does not exist: {data_dir}")

    img_size = (224, 224)

    train_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.2,
        subset="training",
        seed=42,
        image_size=img_size,
        batch_size=batch_size,
    )
    val_ds = tf.keras.utils.image_dataset_from_directory(
        data_dir,
        validation_split=0.2,
        subset="validation",
        seed=42,
        image_size=img_size,
        batch_size=batch_size,
    )

    class_names = train_ds.class_names
    num_classes = len(class_names)
    if num_classes < 2:
        raise ValueError("Expected at least 2 class subdirectories inside --data-dir.")

    autotune = tf.data.AUTOTUNE
    train_ds = train_ds.prefetch(buffer_size=autotune)
    val_ds = val_ds.prefetch(buffer_size=autotune)

    data_augmentation = tf.keras.Sequential(
        [
            tf.keras.layers.RandomFlip("horizontal"),
            tf.keras.layers.RandomRotation(0.1),
            tf.keras.layers.RandomZoom(0.1),
        ],
        name="leaf_augmentation",
    )

    base_model = tf.keras.applications.MobileNetV2(
        input_shape=(224, 224, 3),
        include_top=False,
        weights="imagenet",
    )
    base_model.trainable = False

    inputs = tf.keras.Input(shape=(224, 224, 3), name="leaf_image")
    # Expects images preprocessed to [-1, 1] by ml/preprocessing.py
    x = data_augmentation(inputs)
    x = base_model(x, training=False)
    x = tf.keras.layers.GlobalAveragePooling2D()(x)
    x = tf.keras.layers.Dropout(0.25)(x)
    outputs = tf.keras.layers.Dense(num_classes, activation="softmax")(x)

    model = tf.keras.Model(inputs, outputs, name="plantcare_mobilenetv2")
    model.compile(
        optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),
        loss="sparse_categorical_crossentropy",
        metrics=["accuracy"],
    )

    # Note: image_dataset_from_directory loads [0, 255]; rescale to [-1, 1] for training
    def normalize_batch(images, labels):
        return (tf.cast(images, tf.float32) / 127.5) - 1.0, labels

    train_norm = train_ds.map(normalize_batch, num_parallel_calls=autotune)
    val_norm = val_ds.map(normalize_batch, num_parallel_calls=autotune)

    model.fit(train_norm, validation_data=val_norm, epochs=epochs)

    os.makedirs(output_dir, exist_ok=True)
    model_path = os.path.join(output_dir, "plant_disease_model.keras")
    classes_path = os.path.join(output_dir, "class_names.json")

    model.save(model_path)
    with open(classes_path, "w", encoding="utf-8") as fh:
        json.dump(class_names, fh, indent=2)

    print(f"Saved trained model to {model_path}")
    print(f"Saved {len(class_names)} class labels to {classes_path}")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Train PlantCare MobileNetV2 classifier.")
    parser.add_argument("--data-dir", required=True, help="Path to class-structured leaf dataset")
    parser.add_argument("--epochs", type=int, default=10, help="Number of training epochs")
    parser.add_argument("--batch-size", type=int, default=32, help="Training batch size")
    parser.add_argument("--output-dir", default="models", help="Directory to store model artifacts")
    args = parser.parse_args()

    build_and_train(args.data_dir, args.epochs, args.batch_size, args.output_dir)
