import Button from './Button';
import ContextMenu from './ContextMenu';
import Stack from './Stack';
import Text from './Text';

interface ExerciseActionsMenuProps {
  open: boolean;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onNote: () => void;
  onMedia: () => void;
}

const ExerciseActionsMenu = ({ open, onClose, onEdit, onDelete, onNote, onMedia }: ExerciseActionsMenuProps) => {
  const handleAction = (action: () => void) => {
    action();
    onClose();
  };

  return (
    <ContextMenu open={open} onClose={onClose} title="Действия" variant="inline">
      <Stack direction="row" gap="md" justify="space-between" align="center" wrap>
        <Button variant="ghost" size="sm" onClick={() => handleAction(onEdit)}>
          <Stack gap="xs" align="center">
            <Text variant="body">✏️</Text>
            <Text variant="micro">РЕДАКТИРОВАТЬ</Text>
          </Stack>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction(onDelete)}>
          <Stack gap="xs" align="center">
            <Text variant="body">🗑</Text>
            <Text variant="micro">УДАЛИТЬ</Text>
          </Stack>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction(onNote)}>
          <Stack gap="xs" align="center">
            <Text variant="body">📝</Text>
            <Text variant="micro">ЗАМЕТКА</Text>
          </Stack>
        </Button>
        <Button variant="ghost" size="sm" onClick={() => handleAction(onMedia)}>
          <Stack gap="xs" align="center">
            <Text variant="body">📷</Text>
            <Text variant="micro">ФОТО/ВИДЕО</Text>
          </Stack>
        </Button>
      </Stack>
    </ContextMenu>
  );
};

export default ExerciseActionsMenu;
