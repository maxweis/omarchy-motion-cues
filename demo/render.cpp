// Offscreen export of the real Qt Quick bubble renderer. No desktop capture.
#include <QGuiApplication>
#include <QQuickView>
#include <QQuickItem>
#include <QImage>
#include <QTimer>
#include <QDir>
#include <QDebug>

int main(int argc, char **argv) {
    QGuiApplication app(argc, argv);
    if (argc != 3 && argc != 4) return 2;
    QQuickWindow::setSceneGraphBackend("software");
    QQuickView view;
    view.setSource(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])));
    if (view.status() != QQuickView::Ready) return 1;
    if (argc == 4) view.rootObject()->setProperty("desktopExample", true);
    const QVariant duration = view.rootObject()->property("duration");
    const int frameCount = qRound((duration.isValid() ? duration.toDouble() : 14.0) * 30);
    if (frameCount <= 0 || frameCount > 30 * 60) return 2;
    view.show();
    const QDir frames(QString::fromLocal8Bit(argv[2]));
    QTimer timer;
    int frame = 0;
    int readinessChecks = 0;
    QObject::connect(&timer, &QTimer::timeout, [&]() {
        // Optional readiness gate for demos with asynchronously loaded assets.
        const QVariant ready = view.rootObject()->property("renderReady");
        if (ready.isValid() && !ready.toBool()) {
            if (++readinessChecks > 300) {
                qCritical() << "Demo assets did not become ready";
                app.exit(1);
            }
            return;
        }
        if (!QMetaObject::invokeMethod(view.rootObject(), "advance", Q_ARG(QVariant, frame / 30.0))) {
            app.exit(1);
            return;
        }
        const auto image = view.grabWindow();
        if (image.isNull() || !image.save(frames.filePath(QString("%1.png").arg(frame, 4, 10, QChar('0'))))) {
            qCritical() << "Frame export failed";
            app.exit(1);
            return;
        }
        if (++frame == frameCount) app.quit();
    });
    timer.start(33);
    return app.exec();
}
