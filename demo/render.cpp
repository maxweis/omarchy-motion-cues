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
    if (argc != 3) return 2;
    QQuickWindow::setSceneGraphBackend("software");
    QQuickView view;
    view.setSource(QUrl::fromLocalFile(QString::fromLocal8Bit(argv[1])));
    if (view.status() != QQuickView::Ready) return 1;
    view.show();
    const QDir frames(QString::fromLocal8Bit(argv[2]));
    QTimer timer;
    int frame = 0;
    QObject::connect(&timer, &QTimer::timeout, [&]() {
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
        if (++frame == 420) app.quit();
    });
    timer.start(33);
    return app.exec();
}
