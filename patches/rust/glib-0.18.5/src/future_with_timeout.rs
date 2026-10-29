// Take a look at the license at the top of the repository in the LICENSE file.

use std::{error, fmt};

use futures_util::{
    future::{self, Either, Future},
    pin_mut,
};

// rustdoc-stripper-ignore-next
/// The error returned when a future times out.
#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub struct FutureWithTimeoutError;

impl fmt::Display for FutureWithTimeoutError {
    fn fmt(&self, f: &mut fmt::Formatter) -> fmt::Result {
        f.write_str("The future timed out")
    }
}

impl error::Error for FutureWithTimeoutError {}

// rustdoc-stripper-ignore-next
/// Add a timeout to a `Future`.
///
/// The `Future` must be spawned on an `Executor` backed by a `glib::MainContext`.
pub async fn future_with_timeout_with_priority<T>(
    priority: crate::Priority,
    timeout: std::time::Duration,
    fut: impl Future<Output = T>,
) -> Result<T, FutureWithTimeoutError> {
    let timeout = crate::timeout_future_with_priority(priority, timeout);
    pin_mut!(fut);

    match future::select(fut, timeout).await {
        Either::Left((x, _)) => Ok(x),
        _ => Err(FutureWithTimeoutError),
    }
}

// rustdoc-stripper-ignore-next
/// Add a timeout to a `Future`.
///
/// The `Future` must be spawned on an `Executor` backed by a `glib::MainContext`.
pub async fn future_with_timeout<T>(
    timeout: std::time::Duration,
    fut: impl Future<Output = T>,
) -> Result<T, FutureWithTimeoutError> {
    future_with_timeout_with_priority(crate::Priority::default(), timeout, fut).await
}
