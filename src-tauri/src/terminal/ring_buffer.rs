/// Default scrollback kept per session (raw bytes, escape sequences included).
pub const DEFAULT_SCROLLBACK_BYTES: usize = 2 * 1024 * 1024;

/// Byte-capped scrollback of the raw PTY stream.
///
/// The raw stream (not parsed lines) is kept so a re-mounted terminal can replay it and
/// end up with the same colours, cursor state and full-screen layout it had before.
#[derive(Debug, Clone)]
pub struct RingBuffer {
    capacity: usize,
    data: String,
    total_bytes: u64,
}

impl RingBuffer {
    pub fn new(capacity_bytes: usize) -> Self {
        let capacity = if capacity_bytes == 0 {
            DEFAULT_SCROLLBACK_BYTES
        } else {
            capacity_bytes
        };
        Self {
            capacity,
            data: String::new(),
            total_bytes: 0,
        }
    }

    /// Appends raw output. Trimming is amortised: it only runs once the buffer is 25% over capacity.
    pub fn push_chunk(&mut self, chunk: &str) {
        self.total_bytes += chunk.len() as u64;
        self.data.push_str(chunk);
        if self.data.len() > self.capacity + self.capacity / 4 {
            self.trim_to_capacity();
        }
    }

    /// Drops the oldest bytes, cutting at a line start when one exists so the replay
    /// never begins in the middle of an escape sequence.
    fn trim_to_capacity(&mut self) {
        let mut cut = self.data.len() - self.capacity;
        while !self.data.is_char_boundary(cut) {
            cut += 1;
        }
        if let Some(newline) = self.data[cut..].find('\n') {
            cut += newline + 1;
        }
        self.data.drain(..cut);
    }

    pub fn snapshot(&self) -> String {
        self.data.clone()
    }

    pub fn clear(&mut self) {
        self.data.clear();
    }

    pub fn len(&self) -> usize {
        self.data.len()
    }

    pub fn is_empty(&self) -> bool {
        self.data.is_empty()
    }

    pub fn capacity(&self) -> usize {
        self.capacity
    }

    /// Bytes ever pushed, including the ones already trimmed away.
    pub fn total_bytes(&self) -> u64 {
        self.total_bytes
    }
}

impl Default for RingBuffer {
    fn default() -> Self {
        Self::new(DEFAULT_SCROLLBACK_BYTES)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn keeps_raw_stream_including_escape_sequences() {
        let mut rb = RingBuffer::new(1024);
        rb.push_chunk("\x1b[32mok\x1b[0m\r\n");
        rb.push_chunk("partial");
        assert_eq!(rb.snapshot(), "\x1b[32mok\x1b[0m\r\npartial");
        assert_eq!(rb.total_bytes(), 20);
    }

    #[test]
    fn trims_oldest_bytes_at_a_line_start() {
        let mut rb = RingBuffer::new(100);
        for i in 0..50 {
            rb.push_chunk(&format!("line number {i}\n"));
        }
        let snapshot = rb.snapshot();
        assert!(snapshot.len() <= 125, "len was {}", snapshot.len());
        assert!(snapshot.starts_with("line number "));
        assert!(snapshot.ends_with("line number 49\n"));
        assert!(rb.total_bytes() > snapshot.len() as u64);
    }

    #[test]
    fn never_splits_a_multibyte_character() {
        let mut rb = RingBuffer::new(10);
        rb.push_chunk(&"ção".repeat(20));
        let snapshot = rb.snapshot();
        assert!(snapshot.chars().all(|c| "ção".contains(c)));
    }

    #[test]
    fn clear_empties_the_buffer() {
        let mut rb = RingBuffer::new(64);
        rb.push_chunk("abc");
        rb.clear();
        assert!(rb.is_empty());
    }
}
