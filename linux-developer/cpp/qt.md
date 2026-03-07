---
layout: guide
title: "Qt Framework"
description: "Build cross-platform applications with Qt — signals & slots, the event loop, QObject hierarchy, widgets, QML, serial port and embedded Linux integration."
stage: "Stage 03"
phase: "linux-developer-cpp"
phase_label: "Phase 02 — Linux Developer"
phase_name: "C++ Programming"
phase_index: "/linux-developer/cpp/"
permalink: /linux-developer/cpp/qt/
prev_topic:
  title: "CMake"
  url: /linux-developer/cpp/cmake/
next_topic:
  title: "C++17 & C++20"
  url: /linux-developer/cpp/cpp17-cpp20/
---

## Qt Overview
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Qt is a **cross-platform C++ framework** used in embedded Linux HMIs, desktop applications, and industrial control systems. It extends C++ with a meta-object system that enables signals & slots, reflection, and QML.

**Key modules:**

| Module | Purpose |
|--------|---------|
| `QtCore` | QObject, signals/slots, event loop, threads, containers |
| `QtWidgets` | Desktop GUI widgets (QPushButton, QLabel, QMainWindow) |
| `QtQuick/QML` | Fluid, declarative UI for touch/embedded |
| `QtSerialPort` | UART/serial communication |
| `QtNetwork` | TCP/UDP sockets, HTTP |
| `QtDBus` | IPC via D-Bus (Linux) |

### Hello Qt

```cpp
// main.cpp
#include <QApplication>
#include <QLabel>

int main(int argc, char* argv[]) {
    QApplication app(argc, argv);

    QLabel label("Hello, Qt!");
    label.show();

    return app.exec();   // starts the event loop
}
```

```cmake
# CMakeLists.txt
cmake_minimum_required(VERSION 3.16)
project(HelloQt)

find_package(Qt6 REQUIRED COMPONENTS Widgets)
qt_standard_project_setup()

add_executable(helloqt main.cpp)
target_link_libraries(helloqt PRIVATE Qt6::Widgets)
```

---

## Signals & Slots
{:.gc-basic}

<span class="guide-chip gc-basic"><i class="fas fa-seedling"></i> Basic</span>

Qt's **signals & slots** is a type-safe, loosely coupled event/callback system. Objects emit signals; connected slots are called automatically.

```cpp
#include <QObject>

class Sensor : public QObject {
    Q_OBJECT   // REQUIRED macro — enables meta-object features

    float value_ = 0.0f;

public:
    explicit Sensor(QObject* parent = nullptr) : QObject(parent) {}

    float value() const { return value_; }

public slots:
    void setValue(float v) {
        if (v != value_) {
            value_ = v;
            emit valueChanged(v);   // emit the signal
        }
    }

signals:
    void valueChanged(float newValue);    // declaration only — Qt generates body
    void alarmTriggered(const QString& msg);
};
```

### Connecting Signals to Slots

```cpp
Sensor* sensor = new Sensor(this);
QLabel* label  = new QLabel(this);

// Syntax 1: Qt5+ function pointer (compile-time checked)
connect(sensor, &Sensor::valueChanged,
        label,  [label](float v){
            label->setText(QString::number(v, 'f', 2));
        });

// Syntax 2: Old-style SIGNAL/SLOT macros (runtime string match)
connect(sensor, SIGNAL(valueChanged(float)),
        label,  SLOT(setText(QString)));   // type mismatch only caught at runtime!

// Connecting to a lambda
connect(sensor, &Sensor::alarmTriggered,
        [](const QString& msg){ qWarning() << "ALARM:" << msg; });

// Triggering the signal
sensor->setValue(23.7f);  // emits valueChanged → label updates automatically
```

### Connection Types

| Type | When | Use Case |
|------|------|---------|
| `AutoConnection` (default) | Same thread → Direct; different thread → Queued | General use |
| `DirectConnection` | Slot called immediately in emitter's thread | Same-thread callbacks |
| `QueuedConnection` | Slot called in receiver's event loop | Cross-thread safe |
| `BlockingQueuedConnection` | Like Queued but emitter blocks | Synchronous cross-thread |

---

## QObject and Object Ownership
{:.gc-mid}

<span class="guide-chip gc-mid"><i class="fas fa-fire-flame-curved"></i> Intermediate</span>

Qt uses a **parent-child ownership** system. When a parent QObject is destroyed, it recursively destroys all its children — automatic memory management.

```cpp
// Parent takes ownership of children
QWidget* window = new QWidget();            // no parent — must delete manually
QLabel* label   = new QLabel("Hello", window);  // window owns label
QPushButton* btn = new QPushButton("OK", window);

// When window is destroyed, label and btn are destroyed too
delete window;  // label and btn deleted automatically

// With smart pointers at the top level:
auto window = std::make_unique<QWidget>();
// children created with raw new + parent are still safe
auto* label = new QLabel("Hello", window.get());
// window destroyed when it goes out of scope → label destroyed too
```

### QObject Rules

```cpp
// QObjects must NOT be copied — they have identity (connections, parent/child)
// Copy constructor and assignment are DELETED in QObject
Sensor s1;
// Sensor s2 = s1;  // compile error!

// Use pointers or references to pass QObjects around
void process(Sensor* s) { s->setValue(5.0f); }
```

---

## The Event Loop
{:.gc-mid}

Qt is **event-driven**. `QCoreApplication::exec()` starts the event loop which processes events: user input, timers, socket notifications, cross-thread signals.

```cpp
#include <QCoreApplication>
#include <QTimer>

int main(int argc, char* argv[]) {
    QCoreApplication app(argc, argv);

    // Single-shot timer
    QTimer::singleShot(1000, &app, [](){
        qDebug() << "1 second elapsed";
        QCoreApplication::quit();   // exit event loop
    });

    // Repeating timer
    QTimer* timer = new QTimer(&app);
    QObject::connect(timer, &QTimer::timeout, [](){
        qDebug() << "tick";
    });
    timer->start(500);   // every 500ms

    return app.exec();   // runs until quit()
}
```

### Running Work Without Blocking the UI

```cpp
// WRONG — blocking the event loop freezes the GUI
void MyWidget::onButtonClicked() {
    for (int i = 0; i < 1000000; i++) {
        doHeavyWork();   // blocks UI for seconds!
    }
}

// RIGHT — use QThread or QtConcurrent
#include <QThread>

class Worker : public QObject {
    Q_OBJECT
public slots:
    void doWork() {
        for (int i = 0; i < 1000000; i++) doHeavyWork();
        emit finished();
    }
signals:
    void finished();
    void progress(int percent);
};

// In the widget:
QThread* thread = new QThread(this);
Worker* worker  = new Worker;   // no parent — will move to thread
worker->moveToThread(thread);

connect(thread, &QThread::started,   worker, &Worker::doWork);
connect(worker, &Worker::finished,   thread, &QThread::quit);
connect(worker, &Worker::finished,   worker, &QObject::deleteLater);
connect(thread, &QThread::finished,  thread, &QObject::deleteLater);

thread->start();
```

---

## Serial Port (Embedded Linux)
{:.gc-adv}

<span class="guide-chip gc-adv"><i class="fas fa-bolt"></i> Advanced</span>

```cmake
find_package(Qt6 REQUIRED COMPONENTS SerialPort)
target_link_libraries(myapp PRIVATE Qt6::SerialPort)
```

```cpp
#include <QSerialPort>
#include <QSerialPortInfo>

// List available ports
const auto ports = QSerialPortInfo::availablePorts();
for (const auto& info : ports)
    qDebug() << info.portName() << info.description();

// Open and configure
QSerialPort serial;
serial.setPortName("/dev/ttyS0");
serial.setBaudRate(QSerialPort::Baud115200);
serial.setDataBits(QSerialPort::Data8);
serial.setParity(QSerialPort::NoParity);
serial.setStopBits(QSerialPort::OneStop);
serial.setFlowControl(QSerialPort::NoFlowControl);

if (!serial.open(QIODevice::ReadWrite)) {
    qCritical() << "Failed to open serial port:" << serial.errorString();
    return;
}

// Async read (signal-driven — never block!)
QObject::connect(&serial, &QSerialPort::readyRead, [&](){
    QByteArray data = serial.readAll();
    qDebug() << "Received:" << data.toHex();
});

// Write
serial.write("\xAA\x55\x01\x00", 4);
```

---

## QML for Embedded HMI
{:.gc-adv}

```qml
// main.qml — Declarative UI
import QtQuick 2.15
import QtQuick.Controls 2.15

ApplicationWindow {
    visible: true
    width: 800; height: 480
    title: "Sensor Dashboard"

    Column {
        anchors.centerIn: parent
        spacing: 20

        Text {
            id: tempLabel
            text: "Temperature: " + sensorBackend.temperature.toFixed(1) + " °C"
            font.pixelSize: 32
            color: sensorBackend.temperature > 80 ? "red" : "white"
        }

        Button {
            text: "Reset"
            onClicked: sensorBackend.reset()
        }
    }
}
```

```cpp
// Expose C++ object to QML
#include <QQmlContext>

SensorBackend backend;
QQmlApplicationEngine engine;
engine.rootContext()->setContextProperty("sensorBackend", &backend);
engine.load(QUrl("qrc:/main.qml"));
```

---

## Interview Q&A
{:.gc-iq}

<span class="guide-chip gc-iq"><i class="fas fa-circle-question"></i> Interview Q&amp;A</span>

**Q1 — Basic: Explain how Qt's signals and slots differ from plain function callbacks.**

> Signals and slots are type-safe (checked at compile time with the function-pointer syntax), loosely coupled (the emitter doesn't know about the receiver), and thread-aware (queued connections automatically marshal across threads). Plain callbacks are tightly coupled — the caller must know the callback's type and manage its lifetime. Signals can be connected to multiple slots and disconnected at runtime without modifying the emitting class. The `Q_OBJECT` macro and moc (Meta-Object Compiler) generate the underlying connection infrastructure.

**Q2 — Basic: What is the Qt event loop and why must it not be blocked?**

> The event loop (`QCoreApplication::exec()`) processes all events: user input, timer callbacks, socket notifications, and queued signal-slot connections. It runs in the main thread. If you block the main thread (long computation, `sleep()`, blocking I/O), no events are processed — the GUI freezes, timers don't fire, and the application becomes unresponsive. Move long-running work to a `QThread` or use `QtConcurrent`, communicating results back to the main thread via queued signals.

**Q3 — Intermediate: How does Qt's parent-child memory management work?**

> Every `QObject` can have a parent (set via constructor or `setParent()`). When a parent is destroyed, it iterates its children list and destroys them recursively. This means GUI widgets created with a parent are automatically cleaned up when the parent widget is destroyed — you don't need to delete them manually. The top-level window (no parent) must be managed manually (`delete` or `unique_ptr`). You cannot use `shared_ptr` directly with QObject children managed this way.

**Q4 — Advanced: How do you safely communicate between a worker QThread and the main thread?**

> Use queued signal-slot connections. Move the worker object to the thread with `moveToThread()`. Signals emitted from the worker thread are queued in the main thread's event loop and delivered safely without race conditions. Never access GUI widgets (which live in the main thread) directly from a worker thread — always use queued signals/slots. For sharing data, use `QMutex` + condition variables or `QAtomicInt`/`QAtomicPointer` for lock-free access.

---

## References
{:.gc-ref}

<span class="guide-chip gc-ref"><i class="fas fa-book-open"></i> References</span>

| Resource | Link |
|----------|------|
| Qt Official Documentation | [doc.qt.io](https://doc.qt.io/) |
| Qt Signals & Slots | [doc.qt.io/qt-6/signalsandslots.html](https://doc.qt.io/qt-6/signalsandslots.html) |
| Qt Threads & Concurrency | [doc.qt.io/qt-6/thread-basics.html](https://doc.qt.io/qt-6/thread-basics.html) |
| Qt for Embedded Linux | [doc.qt.io/qt-6/embedded-linux.html](https://doc.qt.io/qt-6/embedded-linux.html) |
