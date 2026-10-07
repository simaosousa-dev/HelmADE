use std::collections::VecDeque;
use serde::{Deserialize, Serialize};

/// Buffer circular em memória com capacidade limitada para scrollback de terminais.
/// Previne fugas de memória descartando automaticamente linhas antigas quando atinge a capacidade máxima.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RingBuffer {
    capacity: usize,
    lines: VecDeque<String>,
    pending_line: String,
}

impl RingBuffer {
    /// Cria um novo RingBuffer com capacidade máxima de linhas especificada.
    pub fn new(capacity: usize) -> Self {
        let cap = if capacity == 0 { 1000 } else { capacity };
        Self {
            capacity: cap,
            lines: VecDeque::with_capacity(cap.min(10_000)),
            pending_line: String::new(),
        }
    }

    /// Adiciona um fragmento de texto bruto (chunk) emitido pelo PTY.
    /// Divide o texto por novas linhas (\n), preservando linhas parciais no buffer pendente.
    pub fn push_chunk(&mut self, chunk: &str) {
        let mut chars = chunk.chars().peekable();

        while let Some(ch) = chars.next() {
            if ch == '\n' {
                // Finaliza a linha atual, removendo carriage return (\r) se presente
                let mut finished_line = std::mem::take(&mut self.pending_line);
                if finished_line.ends_with('\r') {
                    finished_line.pop();
                }
                self.push_completed_line(finished_line);
            } else {
                self.pending_line.push(ch);
            }
        }
    }

    /// Adiciona uma linha completa ao buffer circular.
    pub fn push_line(&mut self, line: impl Into<String>) {
        self.push_completed_line(line.into());
    }

    fn push_completed_line(&mut self, line: String) {
        if self.lines.len() >= self.capacity {
            self.lines.pop_front();
        }
        self.lines.push_back(line);
    }

    /// Retorna uma cópia ordenada de todas as linhas de scrollback armazenadas,
    /// incluindo qualquer linha pendente não finalizada.
    pub fn get_scrollback(&self) -> Vec<String> {
        let mut result = Vec::with_capacity(self.lines.len() + 1);
        for line in &self.lines {
            result.push(line.clone());
        }
        if !self.pending_line.is_empty() {
            let mut pending = self.pending_line.clone();
            if pending.ends_with('\r') {
                pending.pop();
            }
            result.push(pending);
        }
        result
    }

    /// Limpa todo o histórico de scrollback e reseta a linha pendente.
    pub fn clear(&mut self) {
        self.lines.clear();
        self.pending_line.clear();
    }

    /// Retorna o número de linhas completas armazenadas.
    pub fn len(&self) -> usize {
        self.lines.len()
    }

    /// Retorna true se não houver linhas armazenadas e nenhuma linha pendente.
    pub fn is_empty(&self) -> bool {
        self.lines.is_empty() && self.pending_line.is_empty()
    }

    /// Retorna a capacidade máxima do buffer.
    pub fn capacity(&self) -> usize {
        self.capacity
    }
}

impl Default for RingBuffer {
    fn default() -> Self {
        Self::new(100_000)
    }
}

#[cfg(test)]
pub mod tests {
    use super::*;

    #[test]
    fn test_ring_buffer_basic_push_and_retrieval() {
        let mut rb = RingBuffer::new(5);
        rb.push_line("linha 1");
        rb.push_line("linha 2");
        rb.push_line("linha 3");

        let lines = rb.get_scrollback();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "linha 1");
        assert_eq!(lines[1], "linha 2");
        assert_eq!(lines[2], "linha 3");
    }

    #[test]
    fn test_ring_buffer_fifo_eviction_on_capacity() {
        let mut rb = RingBuffer::new(3);
        rb.push_line("1");
        rb.push_line("2");
        rb.push_line("3");
        assert_eq!(rb.len(), 3);

        // Ultrapassa a capacidade
        rb.push_line("4");
        rb.push_line("5");

        let lines = rb.get_scrollback();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines, vec!["3", "4", "5"]);
    }

    #[test]
    fn test_ring_buffer_chunk_processing_with_newlines() {
        let mut rb = RingBuffer::new(10);
        rb.push_chunk("echo hello\r\nworld\npartial");

        let lines = rb.get_scrollback();
        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0], "echo hello");
        assert_eq!(lines[1], "world");
        assert_eq!(lines[2], "partial");

        // Completar a linha parcial
        rb.push_chunk(" line completed\n");
        let lines_updated = rb.get_scrollback();
        assert_eq!(lines_updated.len(), 3);
        assert_eq!(lines_updated[2], "partial line completed");
    }

    #[test]
    fn test_ring_buffer_high_throughput_burst() {
        let mut rb = RingBuffer::new(1000);
        for i in 0..5000 {
            rb.push_line(format!("log entry number {}", i));
        }

        assert_eq!(rb.len(), 1000);
        let lines = rb.get_scrollback();
        assert_eq!(lines.first().unwrap(), "log entry number 4000");
        assert_eq!(lines.last().unwrap(), "log entry number 4999");
    }
}
